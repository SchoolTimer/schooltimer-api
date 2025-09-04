import requests
from bs4 import BeautifulSoup
import datetime
import os
from dotenv import load_dotenv

load_dotenv()

def get_dates():
    """Return dict of today, tomorrow, after with both formats"""
    dates = {}
    for offset, key in zip([0, 1, 2], ["today", "tomorrow", "after"]):
        d = datetime.date.today() + datetime.timedelta(days=offset)
        dates[key] = {
            "long": f"{d.strftime('%A')}, {d.strftime('%B')} {d.day}",
            "no_comma": f"{d.strftime('%A')} {d.strftime('%B')} {d.day}",
        }
    return dates

def extract_day_number(text):
    """Find 'Day 1'...'Day 6' in text"""
    for i in range(1, 7):
        if f"Day {i}" in text:
            return str(i)
    return None

def next_day_number(n, step=1):
    """Advance cycle by step (wrap around 1–6)"""
    return str(((int(n) - 1 + step) % 6) + 1)

def detect_schedule(text, base_day):
    """Return Day+Letter if schedule marker exists"""
    schedules = {"HS-ASchedule": "A", "HS-BSchedule": "B",
                 "HS-CSchedule": "C", "HS-DSchedule": "D"}
    for key, val in schedules.items():
        if key in text:
            return base_day + val
    return base_day

# === Main Logic ===

def dayCycle():
    url = "https://phs.parklandsd.org/about/calendar"
    print(f"Fetching data from: {url} at {datetime.date.today().isoformat()}")

    page = requests.get(url)
    if page.status_code != 200:
        print(f"Failed to fetch page: Status {page.status_code}, {page.text}")
        return

    soup = BeautifulSoup(page.text, "html.parser")
    dates = get_dates()

    tag, cycle_day = None, None
    for ev in soup.findAll("article", {"class": "fsCalendarBlockEvent"}):
        text = ev.text.strip()
        for key, date_formats in dates.items():
            if date_formats["long"] in text or date_formats["no_comma"] in text:
                tag, cycle_day = key, extract_day_number(text)

    if not cycle_day:
        print("No cycle day found")
        return

    # Collect schedule strings
    scraped = {"today": "N/A", "tomorrow": "N/A", "after": "N/A"}
    for div in soup.findAll("div", {"class": "fsStateHasEvents"}):
        text = div.text.replace("\n", " ")
        if "Schedule" not in text:
            continue
        for key, date_formats in dates.items():
            if date_formats["long"] in text or date_formats["no_comma"] in text:
                scraped[key] = text

    # Resolve cycle numbers
    if tag == "today":
        cycles = {"today": cycle_day,
                  "tomorrow": next_day_number(cycle_day, 1),
                  "after": next_day_number(cycle_day, 2)}
    elif tag == "tomorrow":
        cycles = {"today": None,
                  "tomorrow": cycle_day,
                  "after": next_day_number(cycle_day, 1)}
    elif tag == "after":
        cycles = {"today": None, "tomorrow": None, "after": cycle_day}
    else:
        cycles = {}

    # Build final results
    finals = {}
    for key in ["today", "tomorrow", "after"]:
        if scraped[key] == "N/A" or not cycles.get(key):
            finals[key] = "N/A"
        else:
            clean_text = scraped[key].replace(" ", "")
            finals[key] = detect_schedule(clean_text, cycles[key])

    # Print local results
    print("\nScraped Results:")
    print(f"Today: {finals['today']}")
    print(f"Tomorrow: {finals['tomorrow']}")
    print(f"Day after tomorrow: {finals['after']}")

    # === Push data to API ===
    api_url = os.environ.get("DAYCYCLE_UPDATE_API")
    api_key = os.environ.get("API_KEY")

    if not api_url:
        print("Error: DAYCYCLE_UPDATE_API not set in environment variables")
        return
    if not api_key:
        print("Error: API_KEY not set in environment variables")
        return

    payload = {
        "today": finals["today"],
        "tomorrow": finals["tomorrow"],
        "next_day": finals["after"]
    }
    headers = {
        "Content-Type": "application/json",
        "api-key": api_key
    }

    print(f"\nSending POST to {api_url} with payload: {payload}")
    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=10)
        print(f"API Response Status: {response.status_code}")
        print(f"API Response Text: {response.text}")
        if response.status_code != 200:
            print(f"Error: Update failed with status {response.status_code}, response: {response.text}")
        else:
            print("Day cycle updated successfully")
    except requests.RequestException as e:
        print(f"Network or API error: {str(e)}")

if __name__ == "__main__":
    dayCycle()
