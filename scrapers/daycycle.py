import requests
from bs4 import BeautifulSoup
from datetime import date, timedelta
import re
import os

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
page = requests.get(url)
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

# Push data to Vercel API
api_url = os.environ.get('DAYCYCLE_UPDATE_API')
api_key = os.environ.get('API_KEY')
payload = {
    'today': final1,
    'tomorrow': final2,
    'nextDay': final3
}
headers = {
    'Content-Type': 'application/json',
    'api-key': api_key
}

response = requests.post(api_url, json=payload, headers=headers)
print("API Response Status:", response.status_code)

# Print local results
print(f"\nLocal Results:")
print(f"Today: {final1}")
print(f"Tomorrow: {final2}")
print(f"Day after tomorrow: {final3}")