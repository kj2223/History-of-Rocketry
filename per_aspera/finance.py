"""Prototype no-year R&D appropriation ledger. No automatic appropriations or cross-account transfers."""
from datetime import datetime, timedelta
from .definitions import SCENARIO

LINES = {
    "engineering": ("Engineering investigations and changes", 735000),
    "readiness": ("Mission qualification and assurance", 465000),
    "operations": ("Approved flight operations", 300000),
}


def fiscal_year(hour):
    date = datetime.fromisoformat(SCENARIO["start"]) + timedelta(hours=hour)
    # The playable 1969 slice uses the contemporary July–June fiscal year.
    return date.year + (date.month >= 7)


def available(line):
    return line["allocation"] - line["committed"] - line["expended"]


def line_for(kind, target=""):
    if kind == "flight":
        return "operations"
    if kind == "clearance" or kind == "test" and target in ("integration", "crew"):
        return "readiness"
    return "engineering"


def initialise(state, legacy=False):
    total = SCENARIO["budget"]
    lines = {key: {"name": name, "appropriation": "rd", "allocation": amount, "committed": 0, "expended": 0} for key, (name, amount) in LINES.items()}
    finance = {"fiscal_year": fiscal_year(state.hour), "appropriated": total, "reserve": total - sum(line["allocation"] for line in lines.values()), "reserve_appropriation": "rd", "lines": lines, "requests": [], "transactions": [], "opening_uncommitted": state.budget, "migrated": legacy}
    if legacy:
        # Preserve old buying power exactly; historical costs lack an account breakdown.
        outstanding = sum(job.cost for job in state.jobs) + (100000 if state.flight else 0)
        paid = total - state.budget - outstanding
        if paid < 0:
            raise ValueError("Legacy balance cannot cover its recorded commitments.")
        for line in lines.values():
            line.update(allocation=0, committed=0, expended=0)
        for job in state.jobs:
            lines[line_for(job.kind, job.target)]["committed"] += job.cost
        if state.flight:
            lines["operations"]["committed"] += 100000
        lines["engineering"]["expended"] = paid
        finance["reserve"] = min(300000, state.budget)
        free = state.budget - finance["reserve"]
        # Keep the remaining scheduled flights/readiness affordable where the old balance permits.
        for key, planned in (("operations", max(0, 3 - len(state.results) - bool(state.flight)) * 100000), ("readiness", max(0, 3 - len(state.results)) * 155000)):
            share = min(free, planned)
            lines[key]["allocation"] += share
            free -= share
        lines["engineering"]["allocation"] += free
        for line in lines.values():
            line["allocation"] += line["committed"] + line["expended"]
        # Rebuild every historic authorisation where the old event record identifies its cost.
        import re
        for event in state.events:
            account, amount = "engineering", 0
            if event.title in ("Test authorised", "Configuration change authorised"):
                match = re.search(r"\$([\d,]+)", event.detail)
                if match:
                    amount = int(match.group(1).replace(",", ""))
                if event.title == "Test authorised":
                    method = next((key for key, test in SCENARIO["tests"].items() if event.detail.startswith(test["name"] + ";")), "")
                    account = line_for("test", method)
            elif event.title == "Independent readiness review commissioned":
                account, amount = "readiness", 30000
            elif event.title == "Mission authorised":
                account, amount = "operations", 100000
            if amount:
                finance["transactions"].append({"kind": "obligation", "hour": event.hour, "programme": "Apollo lunar programme", "account": account, "amount": amount, "purpose": event.title + ": " + event.detail, "remaining": 0, "account_remaining": None})
        reconstructed = sum(item["amount"] for item in finance["transactions"])
        if reconstructed != total - state.budget:
            raise ValueError("Legacy expenditure history does not reconcile with its balance; no money has been invented.")
        for key, line in lines.items():
            recorded_paid = sum(item["amount"] for item in finance["transactions"] if item["account"] == key) - line["committed"]
            if recorded_paid < 0:
                raise ValueError("Legacy commitments do not match authorisation history.")
            line["allocation"] += recorded_paid - line["expended"]
            line["expended"] = recorded_paid
        running = total
        for item in finance["transactions"]:
            running -= item["amount"]
            item["remaining"] = running
        finance["opening_uncommitted"] = total
    state.finance = finance
    state.version = 2


def public(finance):
    from copy import deepcopy
    result = deepcopy(finance)
    for item in result["transactions"]:
        item["date"] = (datetime.fromisoformat(SCENARIO["start"]) + timedelta(hours=item["hour"])).strftime("%d %b %Y · %H:%M")
    for line in result["lines"].values():
        line["available"] = available(line)
    result["programme_allocation"] = sum(line["allocation"] for line in result["lines"].values())
    result["programme_available"] = sum(available(line) for line in result["lines"].values())
    result["committed"] = sum(line["committed"] for line in result["lines"].values())
    result["expended"] = sum(line["expended"] for line in result["lines"].values())
    return result


def validate(state):
    f = state.finance
    if not isinstance(f, dict) or set(f["lines"]) != set(LINES):
        raise ValueError("Invalid programme accounts.")
    amounts = [f["appropriated"], f["reserve"], f["fiscal_year"]]
    for line in f["lines"].values():
        if line["appropriation"] != "rd":
            raise ValueError("Unknown appropriation.")
        amounts += [line[key] for key in ("allocation", "committed", "expended")]
        if available(line) < 0:
            raise ValueError("Account exceeds its allocation.")
    if any(type(value) is not int or value < 0 for value in amounts) or f["reserve_appropriation"] != "rd":
        raise ValueError("Invalid financial amount or appropriation.")
    if f["appropriated"] != f["reserve"] + sum(line["allocation"] for line in f["lines"].values()):
        raise ValueError("Appropriation does not reconcile with allocations.")
    if state.budget != f["reserve"] + sum(available(line) for line in f["lines"].values()):
        raise ValueError("Uncommitted balance does not reconcile.")
    for key, line in f["lines"].items():
        expected = sum(job.cost for job in state.jobs if line_for(job.kind, job.target) == key)
        if state.flight and key == "operations":
            expected += 100000
        if expected != line["committed"]:
            raise ValueError("Commitments do not reconcile with authorised work.")
    if f["fiscal_year"] != fiscal_year(state.hour):
        raise ValueError("Fiscal year does not match the campaign date.")
    years = []
    for request in f["requests"]:
        if request["line"] not in LINES or request["status"] != "pending":
            raise ValueError("Invalid funding request.")
        if any(type(request[key]) is not int or request[key] < 0 for key in ("amount", "fiscal_year")) or not 0 < request["amount"] <= 200000:
            raise ValueError("Invalid funding request amount.")
        if request["event"] not in {event.id for event in state.events} or request["fiscal_year"] > f["fiscal_year"]:
            raise ValueError("Invalid funding request provenance.")
        years.append(request["fiscal_year"])
    if len(years) != len(set(years)):
        raise ValueError("Duplicate fiscal-year funding request.")

    running = f["opening_uncommitted"]
    if type(running) is not int or running < 0:
        raise ValueError("Invalid opening balance.")
    for transaction in f["transactions"]:
        if transaction["kind"] not in ("obligation", "reallocation") or transaction["account"] not in LINES or type(transaction["amount"]) is not int or transaction["amount"] <= 0 or type(transaction["hour"]) is not int or not 0 <= transaction["hour"] <= state.hour:
            raise ValueError("Invalid financial transaction.")
        if transaction["kind"] == "reallocation" and (transaction.get("source") not in (*LINES, "reserve") or transaction["source"] == transaction["account"]):
            raise ValueError("Invalid reallocation source.")
        if transaction["kind"] == "obligation":
            running -= transaction["amount"]
        if transaction["remaining"] != running:
            raise ValueError("Transaction running balance does not reconcile.")
    if running != state.budget or f["appropriated"] != SCENARIO["budget"]:
        raise ValueError("Unexplained funds in ledger.")
    for key, line in f["lines"].items():
        charged = sum(item["amount"] for item in f["transactions"] if item["kind"] == "obligation" and item["account"] == key)
        if charged != line["committed"] + line["expended"]:
            raise ValueError("Account charges do not reconcile with commitments and expenditure.")
