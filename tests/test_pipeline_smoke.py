from pathlib import Path

from app.db import get_centres, get_connection, get_samples_for_camera
from scripts.seed_demo import seed_database


def test_seed_configures_only_the_bundled_video_session():
    seed_database()

    centres = get_centres()
    assert len(centres) == 1
    assert centres[0]["name"] == "MP4 Video Session"

    conn = get_connection()
    camera = conn.execute(
        "SELECT source_type, source_uri FROM cameras WHERE centre_id = 1"
    ).fetchone()
    conn.close()

    video_path = Path(__file__).parent.parent / camera["source_uri"]
    assert camera["source_type"] == "video"
    assert video_path.is_file()
    assert get_samples_for_camera(1) == []
