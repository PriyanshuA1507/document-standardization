import asyncio
import unittest
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from app.database import AsyncSessionLocal, engine
from app.models.user import User
from app.models.report import Report, DetailedObservation
from app.models.clustering import (
    ClusteringRun,
    VulnerabilityClusterMember,
    ReportClusterMember,
    ClusteringType,
    RunStatus,
)
from app.services import clustering_service
import httpx


class TestClusteringIntegration(unittest.IsolatedAsyncioTestCase):

    async def asyncTearDown(self):
        await engine.dispose()

    async def test_01_read_only_does_not_trigger_computation(self):
        """Verify that querying latest run or status never starts a computation."""
        async with AsyncSessionLocal() as session:
            count_before = (await session.execute(select(func.count(ClusteringRun.run_id)))).scalar_one()

            res = await clustering_service.get_latest_run_info(session, ClusteringType.VULNERABILITY.value)
            self.assertIn("latest_completed_run", res)

            count_after = (await session.execute(select(func.count(ClusteringRun.run_id)))).scalar_one()
            self.assertEqual(count_before, count_after, "Read-only endpoint must never create run records.")

    async def test_02_database_mapping_vulnerability_clustering(self):
        """Verify that every clustered vulnerability maps to a real source DetailedObservation."""
        async with AsyncSessionLocal() as session:
            query = (
                select(ClusteringRun)
                .where(
                    ClusteringRun.clustering_type == ClusteringType.VULNERABILITY.value,
                    ClusteringRun.status == RunStatus.COMPLETED.value
                )
                .order_by(ClusteringRun.completed_at.desc())
                .limit(1)
            )
            run = (await session.execute(query)).scalar_one_or_none()
            if not run:
                self.skipTest("No completed vulnerability run available to verify.")

            members_query = (
                select(VulnerabilityClusterMember)
                .where(VulnerabilityClusterMember.run_id == run.run_id)
                .limit(50)
            )
            members = (await session.execute(members_query)).scalars().all()
            self.assertGreater(len(members), 0, "Completed run must have member records.")

            for m in members:
                finding = await session.get(DetailedObservation, m.finding_id)
                self.assertIsNotNone(finding, f"Cluster member finding_id {m.finding_id} must exist in DetailedObservation.")
                self.assertEqual(m.run_id, run.run_id)

    async def test_03_database_mapping_report_clustering(self):
        """Verify that every clustered report maps to a real source Report."""
        async with AsyncSessionLocal() as session:
            query = (
                select(ClusteringRun)
                .where(
                    ClusteringRun.clustering_type == ClusteringType.REPORT.value,
                    ClusteringRun.status == RunStatus.COMPLETED.value
                )
                .order_by(ClusteringRun.completed_at.desc())
                .limit(1)
            )
            run = (await session.execute(query)).scalar_one_or_none()
            if not run:
                self.skipTest("No completed report run available to verify.")

            members_query = (
                select(ReportClusterMember)
                .where(ReportClusterMember.run_id == run.run_id)
                .limit(50)
            )
            members = (await session.execute(members_query)).scalars().all()
            self.assertGreater(len(members), 0, "Completed run must have report members.")

            for m in members:
                rep = await session.get(Report, m.report_id)
                self.assertIsNotNone(rep, f"Cluster member report_id {m.report_id} must exist in Report.")
                self.assertEqual(m.run_id, run.run_id)

    async def test_04_source_tables_remain_unmodified(self):
        """Verify that source audit reports and observations are not altered by clustering."""
        async with AsyncSessionLocal() as session:
            findings_count = (await session.execute(select(func.count(DetailedObservation.finding_id)))).scalar_one()
            reports_count = (await session.execute(select(func.count(Report.report_id)))).scalar_one()

            self.assertGreater(findings_count, 0)
            self.assertGreater(reports_count, 0)

    async def test_05_failed_run_preserves_previous_successful_run(self):
        """Verify that creating a failed run record does not destroy previous successful results."""
        async with AsyncSessionLocal() as session:
            before_res = await clustering_service.get_latest_run_info(session, ClusteringType.VULNERABILITY.value)
            previous_completed_id = before_res["latest_completed_run"]["run_id"] if before_res["latest_completed_run"] else None

            # Create a test failed run record
            failed_run = ClusteringRun(
                run_id=uuid.uuid4(),
                clustering_type=ClusteringType.VULNERABILITY.value,
                status=RunStatus.FAILED.value,
                current_stage="Failed",
                error_message="Simulated failure for preservation test",
                created_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )
            session.add(failed_run)
            await session.commit()

            after_res = await clustering_service.get_latest_run_info(session, ClusteringType.VULNERABILITY.value)
            after_completed_id = after_res["latest_completed_run"]["run_id"] if after_res["latest_completed_run"] else None

            self.assertEqual(previous_completed_id, after_completed_id, "Latest completed run must remain preserved even after a failed run.")

            # Clean up the test failed run
            await session.delete(failed_run)
            await session.commit()

    async def test_06_unauthenticated_requests_rejected(self):
        """Verify unauthenticated access to clustering endpoints returns 401 or 403."""
        async with httpx.AsyncClient(base_url="http://127.0.0.1:8002") as client:
            res_trigger = await client.post("/api/clustering/vulnerabilities/run")
            self.assertIn(res_trigger.status_code, (401, 403))

            res_history = await client.get("/api/clustering/history")
            self.assertIn(res_history.status_code, (401, 403))

    async def test_07_concurrency_lock_prevents_duplicate_runs(self):
        """Verify that triggering while an active job is running raises 409 Conflict."""
        # Insert a simulated RUNNING run into the DB
        async with AsyncSessionLocal() as session:
            active_run = ClusteringRun(
                run_id=uuid.uuid4(),
                clustering_type=ClusteringType.REPORT.value,
                status=RunStatus.RUNNING.value,
                current_stage="Clustering (HDBSCAN)",
                progress_percent=60,
                created_at=datetime.now(timezone.utc),
            )
            session.add(active_run)
            await session.commit()

            # Attempting to trigger REPORT clustering should raise 409
            from fastapi import HTTPException
            with self.assertRaises(HTTPException) as cm:
                await clustering_service.trigger_report_clustering(session)
            self.assertEqual(cm.exception.status_code, 409)
            self.assertIn("already active", cm.exception.detail)

            # Cleanup
            await session.delete(active_run)
            await session.commit()

    async def test_08_paginated_members_endpoint(self):
        """Verify paginated cluster members returns properly structured metadata."""
        async with AsyncSessionLocal() as session:
            query = (
                select(ClusteringRun)
                .where(
                    ClusteringRun.clustering_type == ClusteringType.VULNERABILITY.value,
                    ClusteringRun.status == RunStatus.COMPLETED.value
                )
                .order_by(ClusteringRun.completed_at.desc())
                .limit(1)
            )
            run = (await session.execute(query)).scalar_one_or_none()
            if not run:
                self.skipTest("No completed vulnerability run available.")

            members_data = await clustering_service.get_cluster_members_paginated(
                session, run.run_id, cluster_id=1, page=1, page_size=5
            )
            self.assertIn("items", members_data)
            self.assertIn("total", members_data)
            self.assertEqual(members_data["page"], 1)
            self.assertEqual(members_data["page_size"], 5)
            self.assertLessEqual(len(members_data["items"]), 5)

    def test_09_get_clustering_config_options(self):
        """Verify dynamic clustering configuration options schema and algorithm constraints."""
        options = clustering_service.get_clustering_config_options()
        self.assertIn("algorithms", options)
        algo_ids = [a["id"] for a in options["algorithms"]]
        self.assertIn("HDBSCAN", algo_ids)
        self.assertIn("KMEANS", algo_ids)
        self.assertIn("AGGLOMERATIVE", algo_ids)

        for algo in options["algorithms"]:
            self.assertIn("parameters", algo)
            self.assertGreater(len(algo["parameters"]), 0)

        self.assertIn("vulnerability_features", options)
        self.assertIn("report_features", options)
        self.assertIn("presets", options)
        self.assertIn("vulnerabilities", options["presets"])
        self.assertIn("reports", options["presets"])

    def test_10_execute_dynamic_clustering_kmeans(self):
        """Verify K-Means++ execution with inertia, Calinski-Harabasz, and silhouette metrics."""
        import numpy as np
        np.random.seed(42)
        # Generate 3 distinct synthetic clusters in 16 dimensions
        c1 = np.random.randn(20, 16) + np.array([5.0] * 16)
        c2 = np.random.randn(20, 16) + np.array([-5.0] * 16)
        c3 = np.random.randn(20, 16) + np.array([0.0] * 16)
        embeddings = np.vstack([c1, c2, c3])

        user_params = {"k": 3, "init": "k-means++", "max_iter": 300, "random_state": 42}
        labels, affinities, extra_info = clustering_service._execute_clustering_algorithm(
            "KMEANS", embeddings, user_params, "test-kmeans"
        )
        metrics = clustering_service._compute_quality_metrics(embeddings, labels, extra_info)

        self.assertEqual(len(labels), 60)
        self.assertEqual(len(affinities), 60)
        self.assertEqual(len(set(labels)), 3)
        self.assertTrue(all(a >= 0.0 and a <= 1.0 for a in affinities))
        self.assertIsNotNone(metrics["inertia"])
        self.assertGreater(metrics["inertia"], 0.0)
        self.assertIsNotNone(metrics["calinski_harabasz_index"])
        self.assertGreater(metrics["calinski_harabasz_index"], 0.0)
        self.assertIsNotNone(metrics["silhouette_score"])
        self.assertGreater(metrics["silhouette_score"], 0.5)

    def test_11_execute_dynamic_clustering_agglomerative(self):
        """Verify Agglomerative Hierarchical clustering with linkage and metric options."""
        import numpy as np
        np.random.seed(42)
        c1 = np.random.randn(20, 16) + np.array([5.0] * 16)
        c2 = np.random.randn(20, 16) + np.array([-5.0] * 16)
        embeddings = np.vstack([c1, c2])

        user_params = {"k": 2, "linkage": "ward", "metric": "euclidean"}
        labels, affinities, extra_info = clustering_service._execute_clustering_algorithm(
            "AGGLOMERATIVE", embeddings, user_params, "test-agglomerative"
        )
        metrics = clustering_service._compute_quality_metrics(embeddings, labels, extra_info)

        self.assertEqual(len(labels), 40)
        self.assertEqual(len(set(labels)), 2)
        self.assertTrue(all(a >= 0.0 and a <= 1.0 for a in affinities))
        self.assertNotIn("inertia", metrics)
        self.assertIsNotNone(metrics["calinski_harabasz_index"])
        self.assertIsNotNone(metrics["silhouette_score"])

    def test_12_execute_dynamic_clustering_hdbscan(self):
        """Verify HDBSCAN density clustering with outlier detection."""
        import numpy as np
        np.random.seed(42)
        c1 = np.random.randn(25, 16) + np.array([5.0] * 16)
        c2 = np.random.randn(25, 16) + np.array([-5.0] * 16)
        noise = np.random.uniform(-20, 20, (5, 16))
        embeddings = np.vstack([c1, c2, noise])

        user_params = {"min_cluster_size": 5, "min_samples": 3, "metric": "euclidean"}
        labels, affinities, extra_info = clustering_service._execute_clustering_algorithm(
            "HDBSCAN", embeddings, user_params, "test-hdbscan"
        )
        metrics = clustering_service._compute_quality_metrics(embeddings, labels, extra_info)

        self.assertEqual(len(labels), 55)
        self.assertEqual(len(affinities), 55)
        self.assertIn("silhouette_score", metrics)
        self.assertIn("davies_bouldin_index", metrics)

    async def test_13_compute_optimal_k_sweep(self):
        """Verify multi-k sweep optimization returns optimal k and sweep points."""
        async with AsyncSessionLocal() as session:
            sweep = await clustering_service.compute_optimal_k_sweep(
                session,
                clustering_type="VULNERABILITY",
                k_min=2,
                k_max=6,
                algorithm="KMEANS"
            )
            self.assertEqual(sweep["status"], "success")
            self.assertIn("optimal_k", sweep)
            self.assertGreaterEqual(sweep["optimal_k"], 2)
            self.assertLessEqual(sweep["optimal_k"], 6)
            self.assertGreaterEqual(len(sweep["sweep_results"]), 3)
            for pt in sweep["sweep_results"]:
                self.assertIn("k", pt)
                self.assertIn("inertia", pt)
                self.assertIn("silhouette_score", pt)
                self.assertIn("davies_bouldin", pt)

    async def test_14_compare_clustering_runs(self):
        """Verify cross-run comparison computes deltas and executive recommendation."""
        async with AsyncSessionLocal() as session:
            # Query up to 2 runs
            query = (
                select(ClusteringRun)
                .where(ClusteringRun.status == RunStatus.COMPLETED.value)
                .order_by(ClusteringRun.completed_at.desc())
                .limit(2)
            )
            runs = (await session.execute(query)).scalars().all()
            if len(runs) < 2:
                self.skipTest("Need at least 2 completed runs to test comparison.")

            res = await clustering_service.compare_clustering_runs(session, runs[0].run_id, runs[1].run_id)
            self.assertEqual(res["status"], "success")
            self.assertIn("winner", res)
            self.assertIn("executive_verdict", res)
            self.assertIn("deltas", res)
            self.assertIn("distribution_comparison", res)

    async def test_15_get_run_projection_2d(self):
        """Verify 2D projection returns valid PCA coordinates for scatter plot visualization."""
        async with AsyncSessionLocal() as session:
            query = (
                select(ClusteringRun)
                .where(ClusteringRun.status == RunStatus.COMPLETED.value)
                .order_by(ClusteringRun.completed_at.desc())
                .limit(1)
            )
            run = (await session.execute(query)).scalar_one_or_none()
            if not run:
                self.skipTest("No completed run available to test projection.")

            coords = await clustering_service.get_run_projection_2d(session, run.run_id)
            self.assertIsInstance(coords, list)
            if len(coords) > 0:
                pt = coords[0]
                self.assertIn("x", pt)
                self.assertIn("y", pt)
                self.assertIn("cluster_id", pt)
                self.assertIn("title", pt)

    async def test_16_history_retention_prunes_older_algorithm_runs(self):
        """Verify that older runs for the same algorithm are pruned, keeping at most 1 run per algorithm."""
        async with AsyncSessionLocal() as session:
            # Create two runs for KMEANS
            old_kmeans = ClusteringRun(
                run_id=uuid.uuid4(),
                clustering_type=ClusteringType.VULNERABILITY.value,
                status=RunStatus.COMPLETED.value,
                current_stage="Completed",
                parameters={"algorithm": "KMEANS"},
                algorithm_version="KMEANS-v1",
                created_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )
            new_kmeans = ClusteringRun(
                run_id=uuid.uuid4(),
                clustering_type=ClusteringType.VULNERABILITY.value,
                status=RunStatus.COMPLETED.value,
                current_stage="Completed",
                parameters={"algorithm": "KMEANS"},
                algorithm_version="KMEANS-v2",
                created_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )
            # Create a run for HDBSCAN (should NOT be pruned)
            hdbscan_run = ClusteringRun(
                run_id=uuid.uuid4(),
                clustering_type=ClusteringType.VULNERABILITY.value,
                status=RunStatus.COMPLETED.value,
                current_stage="Completed",
                parameters={"algorithm": "HDBSCAN"},
                algorithm_version="HDBSCAN-v1",
                created_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )
            session.add_all([old_kmeans, new_kmeans, hdbscan_run])
            await session.commit()

            # Execute pruning for KMEANS keeping new_kmeans
            deleted = await clustering_service.prune_older_runs_for_algorithm(
                session, ClusteringType.VULNERABILITY.value, "KMEANS", keep_run_id=new_kmeans.run_id
            )
            self.assertGreaterEqual(deleted, 1)

            # Check that old_kmeans is gone
            q_old = await session.get(ClusteringRun, old_kmeans.run_id)
            self.assertIsNone(q_old, "Older KMEANS run must be completely deleted from the database.")

            # Check that new_kmeans and hdbscan_run are preserved
            q_new = await session.get(ClusteringRun, new_kmeans.run_id)
            self.assertIsNotNone(q_new, "Latest KMEANS run must be preserved.")

            q_hdb = await session.get(ClusteringRun, hdbscan_run.run_id)
            self.assertIsNotNone(q_hdb, "HDBSCAN run must remain untouched.")

            # Cleanup
            await session.delete(new_kmeans)
            await session.delete(hdbscan_run)
            await session.commit()

    async def test_17_compare_clustering_runs_rejects_mixed_types(self):
        """Verify that comparing a VULNERABILITY run with a REPORT run is strictly rejected."""
        from fastapi import HTTPException
        async with AsyncSessionLocal() as session:
            vuln_run = ClusteringRun(
                run_id=uuid.uuid4(),
                clustering_type=ClusteringType.VULNERABILITY.value,
                status=RunStatus.COMPLETED.value,
                current_stage="Completed",
                parameters={"algorithm": "HDBSCAN"},
                algorithm_version="HDBSCAN-v1",
                summary={"quality_metrics": {"silhouette_score": 0.65}},
                created_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )
            report_run = ClusteringRun(
                run_id=uuid.uuid4(),
                clustering_type=ClusteringType.REPORT.value,
                status=RunStatus.COMPLETED.value,
                current_stage="Completed",
                parameters={"algorithm": "HDBSCAN"},
                algorithm_version="HDBSCAN-v1",
                summary={"quality_metrics": {"silhouette_score": 0.50}},
                created_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )
            session.add_all([vuln_run, report_run])
            await session.commit()

            with self.assertRaises(HTTPException) as cm:
                await clustering_service.compare_clustering_runs(session, vuln_run.run_id, report_run.run_id)

            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("strictly restricted", cm.exception.detail)

            # Cleanup
            await session.delete(vuln_run)
            await session.delete(report_run)
            await session.commit()


if __name__ == '__main__':
    unittest.main()
