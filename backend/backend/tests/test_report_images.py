import unittest
import uuid
from datetime import datetime, timezone

from app.models.report import Report, ReportImage, UploadStatus
from app.schemas.report import ReportImageOut, ReportImageListOut


class TestReportImageModelsAndSchemas(unittest.TestCase):

    def test_report_image_model_instantiation(self):
        report_id = uuid.uuid4()
        img = ReportImage(
            report_id=report_id,
            tag="[IMAGE_PAGE_1_FIG_1]",
            page=1,
            figure=1,
            sha256="abc123def456",
            seaweed_path=f"images/{report_id}/figures/abc123def456.png",
            format="png",
            width=800,
            height=600,
            bbox=[10.0, 20.0, 300.0, 400.0],
            is_figure=True,
        )
        self.assertEqual(img.tag, "[IMAGE_PAGE_1_FIG_1]")
        self.assertEqual(img.page, 1)
        self.assertEqual(img.figure, 1)
        self.assertEqual(img.format, "png")
        self.assertTrue(img.is_figure)
        self.assertEqual(img.seaweed_path, f"images/{report_id}/figures/abc123def456.png")

    def test_report_image_schemas_validation(self):
        img_id = uuid.uuid4()
        rep_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        data = {
            "image_id": img_id,
            "report_id": rep_id,
            "tag": "[IMAGE_PAGE_2_FIG_1]",
            "page": 2,
            "figure": 1,
            "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "seaweed_path": f"images/{rep_id}/figures/e3b0c442.png",
            "format": "png",
            "width": 800,
            "height": 600,
            "bbox": [50.0, 100.0, 450.0, 500.0],
            "file_size": 24500,
            "is_figure": True,
            "created_at": now,
        }

        obj = ReportImageOut.model_validate(data)
        self.assertEqual(obj.tag, "[IMAGE_PAGE_2_FIG_1]")
        self.assertEqual(obj.page, 2)
        self.assertEqual(obj.width, 800)
        self.assertTrue(obj.is_figure)

        list_out = ReportImageListOut(
            images=[obj],
            total=1,
            figure_count=1,
            layout_count=0,
        )
        self.assertEqual(list_out.total, 1)
        self.assertEqual(list_out.figure_count, 1)
        self.assertEqual(list_out.layout_count, 0)


if __name__ == "__main__":
    unittest.main()
