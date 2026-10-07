import json
from pathlib import Path

import jsonschema

from nuit_transcriber.export.document import load_schema
from nuit_transcriber.synthetic import performance_doc, render_audio

WEB_FIXTURE = (
    Path(__file__).resolve().parents[2] / "web" / "src" / "lib" / "data" / "guitar-demo-performance.json"
)


def test_synthetic_document_is_valid():
    jsonschema.validate(performance_doc(), load_schema())


def test_committed_web_fixture_matches_the_generator():
    # compared as data: the committed file is formatted by Biome
    assert json.loads(WEB_FIXTURE.read_text()) == performance_doc()


def test_render_audio_is_normalised_and_long_enough():
    doc = performance_doc()
    audio = render_audio(doc, sr=8000)
    assert audio.dtype.name == "float32"
    assert len(audio) >= int(doc["source"]["durationSec"] * 8000)
    assert 0.8 <= float(abs(audio).max()) <= 0.91
