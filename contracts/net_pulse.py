# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
NetPulse Intelligent Contract

Validates crowdsourced internet speed-test submissions and produces a
consensus-based NetPulse Score (0-100) per area.

Validation rules:
  - download/upload must be 0 < x < 10000 Mbps
  - latency must be 0 < x < 5000 ms
  - reject if same wallet submitted in the same area within 60s (spam)
  - reject if value differs from area average by > 80% with >= 3 samples (outlier)

An LLM is consulted on edge-case submissions to reach consensus across
validators using gl.eq_principle.prompt_comparative.
"""
from genlayer import *
import json
import typing

SPAM_WINDOW_SECONDS = 60
OUTLIER_FACTOR = 0.8


class Submission(typing.TypedDict):
    wallet: str
    area_id: str
    download: float
    upload: float
    latency: float
    isp: str
    timestamp: int


class NetPulse(gl.Contract):
    # last submission timestamp per (area_id|wallet) for spam detection
    last_seen: TreeMap[str, u64]
    # rolling stats per area
    area_count: TreeMap[str, u64]
    area_sum_dl: TreeMap[str, u64]   # stored *100 to keep precision
    area_sum_ul: TreeMap[str, u64]
    area_sum_lat: TreeMap[str, u64]
    area_score: TreeMap[str, u32]

    def __init__(self) -> None:
        pass

    # --------------- helpers ---------------
    def _compute_score(self, download: float, upload: float, latency: float) -> int:
        """
        Deterministic NetPulse Score 0-100.
        Download is the primary factor (caps at 200 Mbps -> 70 pts).
        Upload contributes up to 15 pts (caps at 50 Mbps).
        Latency penalty up to 15 pts (0ms -> +15, 300ms+ -> 0).
        """
        dl_pts = min(download, 200.0) / 200.0 * 70.0
        ul_pts = min(upload, 50.0) / 50.0 * 15.0
        lat_pts = max(0.0, (300.0 - min(latency, 300.0)) / 300.0) * 15.0
        score = int(round(dl_pts + ul_pts + lat_pts))
        return max(0, min(100, score))

    def _basic_valid(self, download: float, upload: float, latency: float) -> bool:
        if download <= 0 or download > 10000:
            return False
        if upload <= 0 or upload > 10000:
            return False
        if latency <= 0 or latency > 5000:
            return False
        return True

    # --------------- write ---------------
    @gl.public.write
    def submit_test(
        self,
        wallet: str,
        area_id: str,
        download: float,
        upload: float,
        latency: float,
        isp: str,
        timestamp: int,
    ) -> str:
        # 1. deterministic sanity checks
        if not self._basic_valid(download, upload, latency):
            return json.dumps({"approved": False, "reason": "out_of_range"})

        # 2. spam check
        key = f"{area_id}|{wallet}"
        last = self.last_seen.get(key, u64(0))
        if last > 0 and timestamp - int(last) < SPAM_WINDOW_SECONDS:
            return json.dumps({"approved": False, "reason": "spam_rate_limited"})

        # 3. outlier check (only once enough samples exist)
        count = int(self.area_count.get(area_id, u64(0)))
        if count >= 3:
            avg_dl = int(self.area_sum_dl[area_id]) / 100.0 / count
            if avg_dl > 0 and abs(download - avg_dl) / avg_dl > OUTLIER_FACTOR:
                # ambiguous — ask validators (LLM) whether to accept
                prompt = (
                    f"Area average download speed is {avg_dl:.2f} Mbps based on "
                    f"{count} samples. A new submission reports {download:.2f} Mbps "
                    f"down / {upload:.2f} up / {latency:.0f} ms latency on ISP "
                    f"'{isp}'. Real network conditions can vary widely (peak hours, "
                    f"5G vs 4G, fiber upgrade). Should this submission be accepted "
                    f"as plausible real-world data, or rejected as an outlier/spam? "
                    f"Respond with ONLY 'accept' or 'reject'."
                )
                try:
                    decision = gl.eq_principle.prompt_comparative(
                        lambda: gl.nondet.exec_prompt(prompt).strip().lower(),
                        "Both answers must agree on accept/reject for the same submission.",
                    )
                except Exception:
                    decision = "reject"
                if "accept" not in decision:
                    return json.dumps({"approved": False, "reason": "outlier_llm_reject"})

        # 4. accepted — update state
        score = self._compute_score(download, upload, latency)
        self.last_seen[key] = u64(timestamp)
        self.area_count[area_id] = u64(count + 1)
        self.area_sum_dl[area_id] = u64(int(self.area_sum_dl.get(area_id, u64(0))) + int(download * 100))
        self.area_sum_ul[area_id] = u64(int(self.area_sum_ul.get(area_id, u64(0))) + int(upload * 100))
        self.area_sum_lat[area_id] = u64(int(self.area_sum_lat.get(area_id, u64(0))) + int(latency))

        # rolling area score = average score across all submissions
        new_count = count + 1
        avg_dl = int(self.area_sum_dl[area_id]) / 100.0 / new_count
        avg_ul = int(self.area_sum_ul[area_id]) / 100.0 / new_count
        avg_lat = int(self.area_sum_lat[area_id]) / new_count
        area_score_val = self._compute_score(avg_dl, avg_ul, avg_lat)
        self.area_score[area_id] = u32(area_score_val)

        return json.dumps({
            "approved": True,
            "score": score,
            "area_score": area_score_val,
            "sample_count": new_count,
        })

    # --------------- views ---------------
    @gl.public.view
    def get_area_score(self, area_id: str) -> int:
        return int(self.area_score.get(area_id, u32(0)))

    @gl.public.view
    def get_area_stats(self, area_id: str) -> str:
        count = int(self.area_count.get(area_id, u64(0)))
        if count == 0:
            return json.dumps({"area_id": area_id, "count": 0})
        return json.dumps({
            "area_id": area_id,
            "count": count,
            "avg_download": int(self.area_sum_dl[area_id]) / 100.0 / count,
            "avg_upload": int(self.area_sum_ul[area_id]) / 100.0 / count,
            "avg_latency": int(self.area_sum_lat[area_id]) / count,
            "score": int(self.area_score.get(area_id, u32(0))),
        })