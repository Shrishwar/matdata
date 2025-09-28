# Entertainment Guesser - Matka Platform

A full-stack web application for entertainment-based guessing of Matka Main Bazar results using historical data analysis, machine learning, and heuristic models.

## ⚠️ Disclaimer

This application is for entertainment purposes only. It provides probabilistic guesses based on historical patterns and does not guarantee accuracy or future results. Always respect the terms of service of data sources like DPBoss.

## Features

- **Real-time Scraping**: Automated scraping of latest results from DPBoss
- **Feature Engineering**: Comprehensive feature extraction from historical data
- **Ensemble Prediction**: Combines frequency, Markov chains, independence assumptions, and ML models
- **Explainable AI**: Provides reasoning for each guess
- **Live Verification**: Compares predictions with live data
- **Admin Controls**: Training triggers and model management

## Tech Stack

- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Frontend**: React, TypeScript, Tailwind CSS
- **ML**: Python, XGBoost, scikit-learn, pandas
- **Scraping**: Cheerio, Puppeteer
- **Deployment**: Docker (planned)

## Quick Start

### Prerequisites

- Node.js 16+
- MongoDB 4.4+
- Python 3.8+ (for ML training)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd matka-platform
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Install Python dependencies**
   ```bash
   pip install pymongo pandas scikit-learn xgboost joblib
   ```

5. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Update connection string in backend code if needed

6. **Seed the database**
   ```bash
   node scripts/seed.js
   ```

### Running the Application

1. **Start MongoDB**
   ```bash
   mongod
   ```

2. **Start the backend**
   ```bash
   cd backend
   npm start
   ```

3. **Start the frontend** (in another terminal)
   ```bash
   cd frontend
   npm start
   ```

4. **Access the app**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Training ML Model

1. **Run the training script**
   ```bash
   python scripts/train_model.py
   ```

2. **Trigger training via API** (admin endpoint)
   ```bash
   POST /api/train
   ```

## API Endpoints

### Public Endpoints

- `GET /api/results` - Get latest results
- `GET /api/results/fetch-latest` - Fetch latest result
- `GET /api/results/guess` - Get predictions
- `GET /api/results/future` - Get upcoming panel info
- `GET /api/results/history` - Get historical results

### Admin Endpoints (require auth)

- `POST /api/train` - Trigger ML training
- `POST /api/results` - Add new result
- `POST /api/results/bulk` - Bulk import results

## Project Structure

```
matka-platform/
├── backend/
│   ├── models/
│   │   ├── Result.js
│   │   └── AnalysisRecord.js
│   ├── routes/
│   │   ├── results.js
│   │   └── auth.js
│   ├── services/
│   │   ├── scraper/
│   │   │   └── dpbossScraper.js
│   │   ├── featurizer.js
│   │   └── predictor.js
│   ├── middleware/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   └── HistoryPage.tsx
│   │   ├── lib/
│   │   │   └── api.ts
│   │   └── context/
│   └── public/
├── scripts/
│   ├── train_model.py
│   └── seed.js
├── models/ (generated)
└── README.md
```

## Data Pipeline

1. **Scraping**: Automated daily scraping from DPBoss
2. **Feature Engineering**: Compute 50+ features per result
3. **Training**: XGBoost model trained on time-series data
4. **Prediction**: Ensemble of heuristics + ML scores
5. **Serving**: REST API with real-time updates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

This project is for educational purposes. Check individual licenses for dependencies.

## Support

For issues or questions, please open a GitHub issue.
