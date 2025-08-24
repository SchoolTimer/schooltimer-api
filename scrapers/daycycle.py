import requests
from bs4 import BeautifulSoup
from datetime import date, timedelta
import re
import os

from dotenv import load_dotenv
load_dotenv()  # Load variables from .env file
import requests

def get_formatted_date(delta_days):
    return (date.today() + timedelta(days=delta_days)).strftime('%A, %B %-d')

def extract_day_and_schedule(event_string):
    day_match = re.search(r'Day (\d)', event_string)
    schedule_match = re.search(r'HS - ([ABCD]) Schedule', event_string)
    
    if 'HOLIDAY' in event_string or 'School Closed' in event_string:
        return 'N/A'
    elif day_match and schedule_match:
        return f"{day_match.group(1)}{schedule_match.group(1)}"
    elif day_match:
        return f"{day_match.group(1)}"
    else:
        return 'N/A'

url = "https://phs.parklandsd.org/about/calendar"
print(f"Fetching data from: {url} at {date.today().isoformat()}")
page = requests.get(url)
if page.status_code != 200:
    print(f"Failed to fetch page: Status {page.status_code}, {page.text}")
    exit(1)
soup = BeautifulSoup(page.content, 'html.parser')

today = get_formatted_date(0)
tomorrow = get_formatted_date(1)
day_after_tomorrow = get_formatted_date(2)

target_dates = [today, tomorrow, day_after_tomorrow]
results = {date: 'N/A' for date in target_dates}

for event in soup.find_all("div", class_="fsStateHasEvents"):
    fullstring = event.text.strip().replace("\n", ' ')
    for target_date in target_dates:
        if target_date in fullstring:
            results[target_date] = extract_day_and_schedule(fullstring)

# Prepare data for API
final1 = results[today]
final2 = results[tomorrow]
final3 = results[day_after_tomorrow]
print(f"\nScraped Results:")
print(f"Today: {final1}")
print(f"Tomorrow: {final2}")
print(f"Day after tomorrow: {final3}")

# Push data to Vercel API
api_url = os.environ.get('DAYCYCLE_UPDATE_API')
api_key = os.environ.get('API_KEY')
if not api_url:
    print("Error: DAYCYCLE_UPDATE_API not set in environment variables")
    exit(1)
if not api_key:
    print("Error: API_KEY not set in environment variables")
    exit(1)
payload = {
    'today': final1,
    'tomorrow': final2,
    'next_day': final3
}
headers = {
    'Content-Type': 'application/json',
    'api-key': api_key
}
print(f"Sending POST to {api_url} with payload: {payload}")

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

# Print local results
print(f"\nLocal Results:")
print(f"Today: {final1}")
print(f"Tomorrow: {final2}")
print(f"Day after tomorrow: {final3}")