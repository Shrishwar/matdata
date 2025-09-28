# DP Matka Prediction Engine

A comprehensive prediction engine for DP Matka that combines statistical analysis and machine learning to predict the most likely numbers.

## Features

- Frequency analysis of historical data
- Chi-square test for randomness
- Autocorrelation analysis
- Markov chain transition matrix
- Runs test for patterns
- Weighted moving averages
- Bayesian probability updates
- Digit correlation analysis
- Machine learning predictions (Random Forest)
- Monte Carlo simulation
- Combined prediction scoring

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Navigate to the prediction engine directory:
   ```bash
   cd backend/prediction-engine
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. **Prepare your data**:
   - Create a JSON file with historical results in the following format:
     ```json
     [
       {"date": "YYYY-MM-DD", "number": 45},
       {"date": "YYYY-MM-DD", "number": 23},
       ...
     ]
     ```
   - Place your data file in the `backend/prediction-engine` directory

2. **Run the prediction engine**:
   ```bash
   node run.js
   ```
   This will analyze the sample data and save the results to `results.json`.

3. **For custom data file**:
   ```bash
   node run.js path/to/your/data.json
   ```

## Output

The engine will display a summary of the analysis and the top 10 predicted numbers with confidence scores. Full detailed results are saved to `results.json`.

## Integration with Web Application

To integrate with your React + ASP.NET application:

1. **Backend (ASP.NET)**:
   - Create an API endpoint that runs the prediction engine
   - Return the prediction results as JSON

2. **Frontend (React)**:
   - Call the prediction API endpoint
   - Display the results in a user-friendly dashboard
   - Add visualizations for the analysis results

## Customization

You can adjust the weights of different prediction methods in the `generatePredictions()` method of `index.js`:

```javascript
const weights = {
  frequency: 0.2,    // Weight for frequency analysis
  transition: 0.3,   // Weight for transition matrix
  bayesian: 0.1,     // Weight for Bayesian updates
  ml: 0.3,           // Weight for machine learning
  monteCarlo: 0.1    // Weight for Monte Carlo simulation
};
```

## License

This project is licensed under the MIT License.
