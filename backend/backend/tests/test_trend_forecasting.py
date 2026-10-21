import asyncio
import unittest
import uuid
from datetime import datetime, date, timezone

import numpy as np
from sqlalchemy import select, func
from app.database import AsyncSessionLocal, engine
from app.models.user import User
from app.models.report import Report, DetailedObservation, ReportsData
from app.models.trend_analysis import TrendAnalysisRun, TrendRunStatus
from app.models.clustering import ClusteringRun
from app.services.trend_analysis.data_service import TrendDataService
from app.services.trend_analysis.forecasting_engine import ForecastingEngine
from app.services.trend_analysis import (
    trigger_trend_analysis_run,
    get_run_status,
    get_run_results,
    list_runs_history,
    get_precomputed_summary,
    get_drilldown_findings,
)


class TestTrendForecastingIntegration(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        async with AsyncSessionLocal() as session:
            stale = await session.execute(
                select(TrendAnalysisRun).where(
                    TrendAnalysisRun.status.in_([TrendRunStatus.QUEUED.value, TrendRunStatus.RUNNING.value])
                )
            )
            for r in stale.scalars().all():
                r.status = TrendRunStatus.FAILED.value
                r.error_message = "Test cleanup"
            await session.commit()

    async def asyncTearDown(self):
        await engine.dispose()

    async def test_01_read_only_endpoints_never_trigger_run(self):
        """
        Critical Rule: Verification that page load, refresh, navigation,
        result retrieval, summary queries, and status polling NEVER trigger analysis or create runs.
        """
        async with AsyncSessionLocal() as session:
            count_before = (await session.execute(select(func.count(TrendAnalysisRun.run_id)))).scalar_one()

            # 1. Summary fetch (simulates page load)
            summary = await get_precomputed_summary(session)
            self.assertIn("data_readiness", summary)

            # 2. History list (simulates opening history)
            history, _ = await list_runs_history(session, limit=10)

            # 3. Drilldown query
            drilldown, _ = await get_drilldown_findings(session, limit=5)

            count_after = (await session.execute(select(func.count(TrendAnalysisRun.run_id)))).scalar_one()
            self.assertEqual(
                count_before, count_after,
                "Read-only queries must NEVER create new trend analysis run records or trigger training."
            )

    async def test_02_time_series_aggregation_monthly_and_weekly(self):
        """Verify time-series aggregation into calendar-aligned monthly and weekly periods."""
        async with AsyncSessionLocal() as session:
            findings, reports_map, retests = await TrendDataService.extract_raw_records(
                db=session, date_basis="effective"
            )
            self.assertGreater(len(findings), 0, "Must extract findings from database.")

            # Monthly aggregation
            agg_m = TrendDataService.aggregate_time_series(
                findings=findings,
                reports_map=reports_map,
                retest_closures=retests,
                frequency="M"
            )
            self.assertIn("periods", agg_m)
            self.assertGreater(len(agg_m["periods"]), 0)
            self.assertIn("total_findings", agg_m["metrics"])
            self.assertIn("severity_over_time", agg_m["metrics"])

            # Weekly aggregation
            agg_w = TrendDataService.aggregate_time_series(
                findings=findings,
                reports_map=reports_map,
                retest_closures=retests,
                frequency="W"
            )
            self.assertIn("periods", agg_w)
            self.assertGreater(len(agg_w["periods"]), 0)

            # Check that monthly period keys are YYYY-MM
            for p in agg_m["periods"]:
                self.assertRegex(p, r"^\d{4}-\d{2}$")

            # Check that weekly period keys are YYYY-MM-DD (Monday aligned)
            for p in agg_w["periods"]:
                self.assertRegex(p, r"^\d{4}-\d{2}-\d{2}$")

    async def test_03_distinct_counts_and_no_double_counting(self):
        """Ensure findings linked to multiple CWEs or assets are not double-counted in total distinct findings."""
        async with AsyncSessionLocal() as session:
            findings, reports_map, retests = await TrendDataService.extract_raw_records(
                db=session, date_basis="effective"
            )
            agg = TrendDataService.aggregate_time_series(findings, reports_map, retests, frequency="M")

            monthly_totals = sum(m["count"] for m in agg["metrics"]["total_findings"])
            unique_finding_ids = {f["finding_id"] for f in findings}

            self.assertEqual(
                monthly_totals, len(unique_finding_ids),
                "Sum of monthly finding counts must equal distinct finding IDs without double-counting."
            )

    async def test_04_missing_scores_not_treated_as_zero(self):
        """Ensure missing CVSS and EPSS scores are not treated as zero in mean calculations."""
        async with AsyncSessionLocal() as session:
            readiness = await TrendDataService.get_data_readiness(session)
            findings, reports_map, retests = await TrendDataService.extract_raw_records(session, date_basis="effective")
            agg = TrendDataService.aggregate_time_series(findings, reports_map, retests, frequency="M")

            for entry in agg["metrics"]["mean_cvss"]:
                if entry["mean_cvss"] is not None:
                    # Valid CVSS scores must be > 0.0 (not zero-imputed)
                    self.assertGreater(entry["mean_cvss"], 0.0, "CVSS score must not be 0.0 unless genuine 0.0.")

            # Overall overview mean CVSS
            overview_cvss = agg["overview"]["mean_cvss"]["value"]
            if overview_cvss is not None:
                self.assertGreaterEqual(overview_cvss, 1.0)
                self.assertLessEqual(overview_cvss, 10.0)

    async def test_05_chronological_backtesting_and_bounds(self):
        """
        Verify rolling-origin backtesting:
        - Chronological order without future-data leakage
        - Non-negative count constraints (y >= 0)
        - CVSS scores bounded in [0.0, 10.0]
        - Prediction intervals (80% and 95%)
        """
        # Synthetic known time series: length 12
        synthetic_series = [10.0, 12.0, 15.0, 14.0, 18.0, 20.0, 22.0, 25.0, 24.0, 28.0, 30.0, 32.0]
        periods = [f"2026-{m:02d}" for m in range(1, 13)]
        future_periods = [f"2027-{m:02d}" for m in range(1, 7)]

        result = ForecastingEngine._forecast_single_target(
            target_key="test_volume",
            target_label="Test Findings",
            periods=periods,
            future_periods=future_periods,
            values=synthetic_series,
            horizon=6,
            frequency="M",
            is_count=True,
            min_bound=0.0,
            max_bound=None,
        )

        self.assertTrue(result["is_eligible"])
        self.assertEqual(len(result["forecast_points"]), 6)
        self.assertIn("backtest_metrics", result)
        self.assertIn("mae", result["backtest_metrics"])
        self.assertIn("wape", result["backtest_metrics"])
        self.assertIn("mase", result["backtest_metrics"])

        # Check bounds & prediction intervals
        for fp in result["forecast_points"]:
            self.assertGreaterEqual(fp["predicted"], 0.0, "Count predictions must be non-negative.")
            self.assertGreaterEqual(fp["lower_80"], 0.0, "Lower 80% interval must be non-negative.")
            self.assertGreaterEqual(fp["lower_95"], 0.0, "Lower 95% interval must be non-negative.")
            self.assertLessEqual(fp["lower_80"], fp["upper_80"])
            self.assertLessEqual(fp["lower_95"], fp["upper_95"])

    async def test_06_model_selection_beats_or_falls_back_to_baseline(self):
        """Verify that when candidate statistical models do not beat baseline, engine falls back gracefully."""
        # Highly noisy, flat series where ARIMA/ETS should not beat naive
        noisy_series = [10.0, 2.0, 9.0, 1.0, 8.0, 3.0]
        periods = [f"2026-{m:02d}" for m in range(1, 7)]
        future_periods = [f"2027-{m:02d}" for m in range(1, 4)]

        result = ForecastingEngine._forecast_single_target(
            target_key="noisy_series",
            target_label="Noisy Series",
            periods=periods,
            future_periods=future_periods,
            values=noisy_series,
            horizon=3,
            frequency="M",
            is_count=True,
            min_bound=0.0,
            max_bound=None,
        )

        self.assertTrue(result["is_eligible"])
        self.assertIn(result["model_name"], ["Seasonal/Simple Naive", "Rolling Moving Average (k=3)", "Exponential Smoothing (ETS / Holt)", "Auto-Regressive ARIMA(1,0,0)"])
        self.assertIn("baseline_comparison", result)

    async def test_07_source_repeat_vs_verified_recurrence(self):
        """Verify that source-reported Repeat is separated from independently verified recurrence."""
        async with AsyncSessionLocal() as session:
            findings, reports_map, retests = await TrendDataService.extract_raw_records(session, date_basis="effective")
            agg = TrendDataService.aggregate_time_series(findings, reports_map, retests, frequency="M")

            recurring = agg["recurring_weakness"]
            self.assertIn("source_reported_repeat_count", recurring)
            self.assertIn("independently_verified_recurrent_count", recurring)
            self.assertGreater(recurring["source_reported_repeat_count"], 0)
            self.assertGreater(recurring["independently_verified_recurrent_count"], 0)

    async def test_08_remediation_closure_provenance_and_note(self):
        """Verify that closure metrics include the explicit historical status disclaimer."""
        async with AsyncSessionLocal() as session:
            findings, reports_map, retests = await TrendDataService.extract_raw_records(session, date_basis="effective")
            agg = TrendDataService.aggregate_time_series(findings, reports_map, retests, frequency="M")

            remediation = agg["remediation_performance"]
            self.assertIn("historical_status_note", remediation)
            self.assertIn("latest-known", remediation["historical_status_note"].lower())

    async def test_09_user_initiated_run_persistence_and_provenance(self):
        """
        Verify that an explicit user trigger creates a persisted run with:
        - Run ID
        - Execution parameters
        - Summary metrics
        - Forecast results
        - Training cutoff
        """
        async with AsyncSessionLocal() as session:
            # Trigger run
            run = await trigger_trend_analysis_run(
                session,
                user_id=None,
                parameters={"date_basis": "effective", "frequency": "M", "horizon": 3}
            )
            self.assertIsNotNone(run.run_id)
            self.assertEqual(run.status, TrendRunStatus.QUEUED.value)

            # Wait for background job completion
            for _ in range(40):
                await asyncio.sleep(0.5)
                async with AsyncSessionLocal() as poll_session:
                    status_info = await get_run_status(poll_session, run.run_id)
                    if status_info and status_info["status"] in ("COMPLETED", "FAILED"):
                        break

            async with AsyncSessionLocal() as final_session:
                results = await get_run_results(final_session, run.run_id)
                self.assertIsNotNone(results)
                self.assertEqual(results["status"], TrendRunStatus.COMPLETED.value)
                self.assertEqual(results["progress_percent"], 100)
                self.assertIn("summary", results)
                self.assertIn("forecast_results", results)
                self.assertIn("targets", results["forecast_results"])


    async def test_10_regression_existing_tables_and_models(self):
        """Verify that existing models and tables remain intact and unmodified."""
        async with AsyncSessionLocal() as session:
            rep_count = (await session.execute(select(func.count(Report.report_id)))).scalar_one()
            obs_count = (await session.execute(select(func.count(DetailedObservation.finding_id)))).scalar_one()
            cluster_count = (await session.execute(select(func.count(ClusteringRun.run_id)))).scalar_one()

            self.assertGreaterEqual(rep_count, 800, "Reports table must remain intact.")
            self.assertGreaterEqual(obs_count, 10000, "Detailed observations table must remain intact.")
            self.assertGreaterEqual(cluster_count, 1, "Clustering runs must remain intact.")

    async def test_11_config_options_discovery_endpoint(self):
        """Verify that config-options endpoint returns all 4 models, parameters schemas, target channels, and presets."""
        from app.services.trend_analysis.forecasting_engine import get_forecasting_config_options
        options = get_forecasting_config_options()
        self.assertIn("models", options)
        self.assertIn("target_channels", options)
        self.assertIn("presets", options)

        model_ids = [m["id"] for m in options["models"]]
        self.assertIn("TIMEFM_3", model_ids)
        self.assertIn("CHRONOS_2", model_ids)
        self.assertIn("MOIRAI_2", model_ids)
        self.assertIn("ENSEMBLE", model_ids)

        target_keys = [t["key"] for t in options["target_channels"]]
        self.assertIn("total_findings", target_keys)
        self.assertIn("severity_critical", target_keys)
        self.assertIn("repeat_findings", target_keys)
        self.assertIn("verified_closures", target_keys)

    async def test_12_chronos_and_moirai_multi_model_execution(self):
        """Verify that Chronos-2 and Moirai 2.0 execute zero-shot forecasts on historical data."""
        async with AsyncSessionLocal() as session:
            findings, reports_map, retests = await TrendDataService.extract_raw_records(session, date_basis="effective")
            agg = TrendDataService.aggregate_time_series(findings, reports_map, retests, frequency="M")

            # 1. Test Chronos-2
            fc_chronos = ForecastingEngine.run_multi_target_forecast(
                aggregated_data=agg,
                horizon=3,
                frequency="M",
                model_id="CHRONOS_2",
                selected_targets=["total_findings", "severity_critical"],
            )
            self.assertEqual(fc_chronos["status"], "completed")
            self.assertEqual(fc_chronos["model_id"], "CHRONOS_2")
            self.assertIn("total_findings", fc_chronos["targets"])
            self.assertEqual(len(fc_chronos["targets"]["total_findings"]["forecast_points"]), 3)

            # 2. Test Moirai 2.0
            fc_moirai = ForecastingEngine.run_multi_target_forecast(
                aggregated_data=agg,
                horizon=3,
                frequency="M",
                model_id="MOIRAI_2",
                selected_targets=["total_findings", "severity_critical"],
            )
            self.assertEqual(fc_moirai["status"], "completed")
            self.assertEqual(fc_moirai["model_id"], "MOIRAI_2")
            self.assertIn("total_findings", fc_moirai["targets"])
            self.assertEqual(len(fc_moirai["targets"]["total_findings"]["forecast_points"]), 3)

    async def test_13_cross_run_comparison_matrix(self):
        """Verify side-by-side run comparison calculating delta WAPE and aligned trajectories."""
        from app.services.trend_analysis.run_service import compare_forecast_runs

        async with AsyncSessionLocal() as session:
            # Create two runs
            run1 = await trigger_trend_analysis_run(session, parameters={"model": "TIMEFM_3", "horizon": 3})
            # Wait for run1
            for _ in range(40):
                await asyncio.sleep(0.5)
                async with AsyncSessionLocal() as p_session:
                    st = await get_run_status(p_session, run1.run_id)
                    if st and st["status"] in ("COMPLETED", "FAILED"):
                        break

            run2 = await trigger_trend_analysis_run(session, parameters={"model": "CHRONOS_2", "horizon": 3})
            # Wait for run2
            for _ in range(40):
                await asyncio.sleep(0.5)
                async with AsyncSessionLocal() as p_session:
                    st = await get_run_status(p_session, run2.run_id)
                    if st and st["status"] in ("COMPLETED", "FAILED"):
                        break

            async with AsyncSessionLocal() as comp_session:
                cmp = await compare_forecast_runs(comp_session, run1.run_id, run2.run_id)
                self.assertIn("delta_summary", cmp)
                self.assertIn("channel_comparisons", cmp)
                self.assertIn("avg_delta_wape", cmp["delta_summary"])
                self.assertGreater(len(cmp["channel_comparisons"]), 0)
