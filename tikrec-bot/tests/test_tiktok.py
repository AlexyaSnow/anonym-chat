from tikrec.tiktok import TikTokClient


def test_normalize_username():
    n = TikTokClient.normalize_username
    assert n("@charli") == "charli"
    assert n("  charli  ") == "charli"
    assert n("https://www.tiktok.com/@charli/live") == "charli"
    assert n("https://www.tiktok.com/@some.user_1") == "some.user_1"


def test_extract_stream_url_prefers_flv_quality():
    info = {
        "stream_url": {
            "flv_pull_url": {
                "SD1": "http://x/sd1.flv",
                "FULL_HD1": "http://x/fhd.flv",
                "HD1": "http://x/hd.flv",
            }
        }
    }
    assert TikTokClient.extract_stream_url(info) == "http://x/fhd.flv"


def test_extract_stream_url_falls_back_to_hls():
    info = {"stream_url": {"hls_pull_url": "http://x/stream.m3u8"}}
    assert TikTokClient.extract_stream_url(info) == "http://x/stream.m3u8"


def test_extract_stream_url_none_when_empty():
    assert TikTokClient.extract_stream_url({}) is None
    assert TikTokClient.extract_stream_url({"stream_url": {}}) is None
