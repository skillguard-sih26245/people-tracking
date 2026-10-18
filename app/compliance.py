from typing import Dict, Tuple, List, Any

def level_high(x: float, warn: float, crit: float) -> str:
    """Classifies high deviation metrics where higher values mean greater violation."""
    if x > crit:
        return "critical"
    elif x > warn:
        return "warning"
    return "normal"

def level_low(x: float, warn_below: float, crit_below: float) -> str:
    """Classifies compliance metrics where lower values mean greater violation."""
    if x < crit_below:
        return "critical"
    elif x < warn_below:
        return "warning"
    return "normal"

def evaluate_attendance_compliance(reported_count: int, observed_count: int, warn_thresh: float = 0.20, crit_thresh: float = 0.40) -> Tuple[str, float]:
    """Calculates attendance discrepancy ratio and level."""
    dev = abs(reported_count - observed_count)
    ratio = round(dev / max(reported_count, 1), 3)
    lvl = level_high(ratio, warn_thresh, crit_thresh)
    return lvl, ratio

def evaluate_infra_compliance(infra_score: float, warn_below: float = 0.80, crit_below: float = 0.60) -> Tuple[str, float]:
    """Evaluates infrastructure score level."""
    lvl = level_low(infra_score, warn_below, crit_below)
    return lvl, infra_score

def evaluate_operability_compliance(operability_scores: Dict[str, float], warn_below: float = 0.50) -> Tuple[str, float]:
    """Evaluates operability score level based on minimum score across classes."""
    if not operability_scores:
        return "normal", 1.0
    min_score = min(operability_scores.values())
    lvl = "warning" if min_score < warn_below else "normal"
    return lvl, min_score

def check_persistence(breach_flags: List[bool], min_samples: int = 20, breach_fraction: float = 0.8) -> bool:
    """Enforces persistence rule: alert only if sustained breaches occur over N samples."""
    if len(breach_flags) < min_samples:
        return False
    # Check last min_samples window
    window = breach_flags[-min_samples:]
    frac = sum(window) / len(window)
    return frac >= breach_fraction
