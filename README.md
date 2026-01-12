# Stock Data Intelligence Dashboard

A mini financial data platform built for the Jarnox Internship Assignment. This dashboard collects, analyzes, and visualizes stock market data with a beautiful web interface.

## 🚀 Features

### ✅ Core Features
- **Real-time Stock Data**: Fetches live data from Yahoo Finance API
- **RESTful API**: FastAPI backend with comprehensive endpoints
- **Interactive Dashboard**: Beautiful UI with Chart.js visualizations
- **Stock Comparison**: Compare two stocks' performance
- **Custom Metrics**: Volatility score, RSI, moving averages
- **Top Gainers/Losers**: Real-time performance tracking

### 🎨 Visualizations
- Price trends with 7-day moving average
- Daily returns bar chart
- Stock comparison charts
- Interactive company selection

### 📊 Data Analysis
- 52-week high/low tracking
- Daily return calculations
- Volatility scoring
- Correlation analysis
- Sector-wise performance

## 🛠️ Tech Stack

### Backend
- **Python** with **FastAPI**
- **SQLite** database
- **Pandas** & **NumPy** for data processing
- **yfinance** for stock data

### Frontend
- **HTML5** & **CSS3** with modern design
- **JavaScript** with **Chart.js**
- **Font Awesome** icons

### Deployment
- **Render** for backend hosting
- **GitHub Pages** for frontend hosting

## 📁 Project Structure
stock-dashboard/
├── backend/
│ ├── app.py # FastAPI application
│ ├── database.py # Database models and setup
│ ├── data_collector.py # Stock data collection
│ ├── requirements.txt # Python dependencies
│ └── Procfile # Render deployment config
├── frontend/
│ ├── index.html # Main dashboard page
│ ├── style.css # Styling
│ └── script.js # Frontend logic
└── README.md # This file