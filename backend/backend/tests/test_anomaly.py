import asyncio
import unittest
import uuid
import numpy as np
from datetime import datetime, timezone

from sqlalchemy import select, func
from app.database import AsyncSessionLocal, engine
from app.models.user import User
from app.models.report import Report
from app.models.anomaly import (
    AnomalyRun,
    AnomalyReportRecord,
    AnomalyRunStatus,
    AnomalyTier,
)
from app.services import anomaly_service


class TestAnomalyDetectionIntegration(unittest.IsolatedAsyncioTestCase):

    async def asyncTearDown(self):
        await engine.dispose()

    async def test_01_config_options_discovery(self):
        """Verify that configuration options expose all three detectors and presets."""
        options = anomaly_service.get_anomaly_config_options()
        self.assertIn("detectors", options)
        self.assertIn("presets", options)
        self.assertIn("feature_catalog", options)

        detector_ids = [d["id"] for d in options["detectors"]]
        self.assertIn("IFOREST", detector_ids)
        self.assertIn("ECOD", detector_ids)
        self.assertIn("EMBEDDING", detector_ids)
        self.assertIn("ENSEMBLE", detector_ids)

        preset_ids = [p["id"] for p in options["presets"]]
        self.assertIn("balanced_tri_model", preset_ids)
        self.assertIn("pure_ecod_explainable", preset_ids)

    def test_02_pure_numpy_ecod_math(self):
        """Verify the mathematical correctness and attribution percentages of pure NumPy ECOD."""
        # Create dataset with clear outlier at index 4
        X = np.array([
            [10.0, 5.0, 1.0],
            [10.2, 4.9, 1.1],
            [9.8, 5.1, 0.9],
            [10.1, 5.0, 1.0],
            [50.0, 25.0, 12.0]  # Extreme multi-attribute outlier
        ])

        scores, attributions = anomaly_service._fit_ecod_pure_numpy(X)

        self.assertEqual(len(scores), 5)
        self.assertEqual(attributions.shape, (5, 3))

        # Outlier at index 4 must have highest score
        self.assertEqual(np.argmax(scores), 4)

        # Attributions for each point must sum to 100%
        for i in range(5):
            self.assertAlmostEqual(float(np.sum(attributions[i])), 100.0, places=2)

    async def test_03_trigger_and_verify_anomaly_run_lifecycle(self):
        """Execute an end-to-end anomaly detection run and verify status and records."""
        async with AsyncSessionLocal() as session:
            # Check report count
            rep_count = (await session.execute(select(func.count(Report.report_id)))).scalar_one()
            if rep_count < 4:
                self.skipTest("Need at least 4 reports in database for lifecycle test.")

            config = {
                "algorithm_mode": "ENSEMBLE",
                "parameters": {
                    "contamination": 0.12,
                    "n_estimators": 80,
                    "weight_iforest": 0.40,
                    "weight_ecod": 0.35,
                    "weight_embedding": 0.25
                }
            }

            run = await anomaly_service.trigger_anomaly_detection(session, config=config)
            self.assertIsNotNone(run.run_id)

            # Wait for execution to finish (up to 60s for SBERT CPU embedding)
            for _ in range(60):
                await asyncio.sleep(1)
                async with AsyncSessionLocal() as poll_session:
                    st = await anomaly_service.get_run_status(poll_session, run.run_id)
                    if st and st["status"] in (AnomalyRunStatus.COMPLETED.value, AnomalyRunStatus.FAILED.value):
                        break

            async with AsyncSessionLocal() as final_session:
                completed_st = await anomaly_service.get_run_status(final_session, run.run_id)
                self.assertEqual(completed_st["status"], AnomalyRunStatus.COMPLETED.value)

                # Retrieve details
                details = await anomaly_service.get_anomaly_run_detail(run.run_id, final_session)
            self.assertEqual(details["status"], "success")
            self.assertGreater(details["run"]["total_reports_evaluated"], 0)
            self.assertGreaterEqual(details["run"]["anomalies_detected"], 1)

            # Check that records have all required scores and attributions
            records = details["records"]
            self.assertGreater(len(records), 0)

            sample_record = records[0]
            self.assertIn("ensemble_score", sample_record)
            self.assertIn("iforest_score", sample_record)
            self.assertIn("ecod_score", sample_record)
            self.assertIn("embedding_score", sample_record)
            self.assertIn("primary_drivers", sample_record)
            self.assertIn("ecod_attributions", sample_record)
            self.assertIn("anomaly_tier", sample_record)

            # Verify scatter points have PCA coordinates
            scatter = details["scatter_points"]
            self.assertGreater(len(scatter), 0)
            self.assertIn("pca_x", scatter[0])
            self.assertIn("pca_y", scatter[0])

    async def test_04_compare_runs(self):
        """Verify cross-run benchmark comparison between two runs."""
        async with AsyncSessionLocal() as session:
            # Query two completed runs
            res = await session.execute(
                select(AnomalyRun)
                .where(AnomalyRun.status == AnomalyRunStatus.COMPLETED.value)
                .order_by(AnomalyRun.created_at.desc())
                .limit(2)
            )
            runs = res.scalars().all()
            if len(runs) < 2:
                self.skipTest("Need at least 2 completed runs to test comparison.")

            comp = await anomaly_service.compare_anomaly_runs(runs[0].run_id, runs[1].run_id, session)
            self.assertEqual(comp["status"], "success")
            self.assertIn("comparison_metrics", comp)
            self.assertIn("agreement_rate_percent", comp["comparison_metrics"])
            self.assertIn("top_discordant_reports", comp)
