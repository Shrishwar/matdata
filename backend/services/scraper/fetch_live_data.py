import requests
import json
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

def fetch_live_data():
    url = "https://dpboss.boston/panel-chart-record/main-bazar.php?full_chart"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table')
        if not table:
            raise Exception("No table found on the page")

        rows = table.find_all('tr')
        data_rows = [row for row in rows if len(row.find_all('td')) >= 16]
        if not data_rows:
            raise Exception("No data rows found in table")

        last_row = data_rows[-1]
        tds = last_row.find_all('td')
        date_range_str = tds[0].get_text(strip=True)
        to_index = date_range_str.lower().find('to')
        if to_index <= 0:
            raise Exception(f"Invalid date range: {date_range_str}")
        start_date_str = date_range_str[:to_index].strip()

        # Parse date
        try:
            start_date = datetime.strptime(start_date_str, '%d/%m/%Y')
        except ValueError:
            try:
                start_date = datetime.strptime(start_date_str, '%m/%d/%Y')
            except ValueError:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')

        date = start_date + timedelta(days=4)  # Friday

        open3 = tds[13].get_text(strip=True)
        middle = tds[14].get_text(strip=True)
        close3 = tds[15].get_text(strip=True)
        double = middle

        if not (len(open3) == 3 and open3.isdigit() and
                len(middle) == 2 and middle.isdigit() and
                len(close3) == 3 and close3.isdigit() and
                len(double) == 2 and double.isdigit()):
            raise Exception("Invalid data format in latest row")

        number = int(double)
        tens = int(double[0])
        units = int(double[1])
        drawId = f"{date.date()}-{number}"
        datetime_str = date.isoformat()
        rawSource = str(last_row)
        sourceUrl = url
        fetchedAt = datetime.now().isoformat()

        result = {
            "drawId": drawId,
            "datetime": datetime_str,
            "number": number,
            "tens": tens,
            "units": units,
            "rawSource": rawSource,
            "sourceUrl": sourceUrl,
            "fetchedAt": fetchedAt
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    fetch_live_data()
