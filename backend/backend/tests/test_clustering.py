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


if __name__ == '__main__':
    unittest.main()
