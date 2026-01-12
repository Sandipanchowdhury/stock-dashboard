import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from database import SessionLocal, Company, StockData

def calculate_metrics(df):
    """Calculate custom metrics for stock data"""
    df = df.copy()
    
    # Daily Return
    df['Daily_Return'] = (df['Close'] - df['Open']) / df['Open']
    
    # 7-day Moving Average
    df['MA_7'] = df['Close'].rolling(window=7).mean()
    
    # 52-week High/Low (252 trading days)
    df['52W_High'] = df['High'].rolling(window=252).max()
    df['52W_Low'] = df['Low'].rolling(window=252).min()
    
    # Custom Metric: Volatility Score (standard deviation of daily returns over 20 days)
    df['Volatility_Score'] = df['Daily_Return'].rolling(window=20).std() * 100
    
    # Custom Metric: RSI (Relative Strength Index)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    return df

def fetch_stock_data(symbol, period="1mo"):
    """Fetch stock data from yfinance"""
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period)
        
        if df.empty:
            return None
            
        df = df.reset_index()
        df.columns = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Dividends', 'Stock Splits']
        
        # Calculate metrics
        df = calculate_metrics(df)
        
        return df
    except Exception as e:
        print(f"Error fetching data for {symbol}: {e}")
        return None

def initialize_sample_companies():
    """Initialize database with sample companies"""
    db = SessionLocal()
    
    # Sample Indian companies (NSE symbols)
    companies = [
        {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Conglomerate"},
        {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "sector": "IT"},
        {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "sector": "Banking"},
        {"symbol": "INFY.NS", "name": "Infosys", "sector": "IT"},
        {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "sector": "Banking"},
        {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel", "sector": "Telecom"},
        {"symbol": "ITC.NS", "name": "ITC Limited", "sector": "FMCG"},
        {"symbol": "SBIN.NS", "name": "State Bank of India", "sector": "Banking"},
        {"symbol": "WIPRO.NS", "name": "Wipro", "sector": "IT"},
        {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever", "sector": "FMCG"},
    ]
    
    # Add companies to database
    for company in companies:
        exists = db.query(Company).filter(Company.symbol == company["symbol"]).first()
        if not exists:
            db_company = Company(
                symbol=company["symbol"],
                name=company["name"],
                sector=company["sector"]
            )
            db.add(db_company)
    
    db.commit()
    
    # Fetch and store recent data for each company
    for company in companies:
        df = fetch_stock_data(company["symbol"], period="3mo")
        if df is not None:
            for _, row in df.iterrows():
                exists = db.query(StockData).filter(
                    StockData.symbol == company["symbol"],
                    StockData.date == row['Date'].date()
                ).first()
                
                if not exists:
                    stock_data = StockData(
                        symbol=company["symbol"],
                        date=row['Date'].date(),
                        open=row['Open'],
                        high=row['High'],
                        low=row['Low'],
                        close=row['Close'],
                        volume=int(row['Volume']),
                        daily_return=row.get('Daily_Return'),
                        moving_avg_7=row.get('MA_7'),
                        week52_high=row.get('52W_High'),
                        week52_low=row.get('52W_Low'),
                        volatility_score=row.get('Volatility_Score')
                    )
                    db.add(stock_data)
    
    db.commit()
    db.close()
    print("Database initialized with sample data!")

if __name__ == "__main__":
    initialize_sample_companies()