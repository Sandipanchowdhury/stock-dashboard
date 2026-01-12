from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import cachetools
from typing import List, Optional

from backend.database import get_db, Company, StockData
from backend.data_collector import fetch_stock_data, calculate_metrics

app = FastAPI(
    title="Stock Data Intelligence Dashboard API",
    description="A mini financial data platform for stock analysis",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache for frequent requests
cache = cachetools.TTLCache(maxsize=100, ttl=300)

@app.get("/")
async def root():
    return {
        "message": "Stock Data Intelligence Dashboard API",
        "endpoints": {
            "/companies": "GET - List all companies",
            "/data/{symbol}": "GET - Get stock data for symbol",
            "/summary/{symbol}": "GET - Get 52-week summary",
            "/compare": "GET - Compare two stocks",
            "/top-gainers": "GET - Get top gainers",
            "/top-losers": "GET - Get top losers",
            "/sectors": "GET - Get all sectors"
        }
    }

@app.get("/companies", response_model=List[dict])
async def get_companies(db: Session = Depends(get_db)):
    """Get all available companies"""
    cache_key = "all_companies"
    if cache_key in cache:
        return cache[cache_key]
    
    companies = db.query(Company).all()
    result = [
        {
            "symbol": c.symbol,
            "name": c.name,
            "sector": c.sector
        }
        for c in companies
    ]
    
    cache[cache_key] = result
    return result

@app.get("/data/{symbol}")
async def get_stock_data(
    symbol: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """Get stock data for specific symbol"""
    cache_key = f"data_{symbol}_{days}"
    if cache_key in cache:
        return cache[cache_key]
    
    # Fetch from database
    cutoff_date = datetime.now().date() - timedelta(days=days)
    
    records = db.query(StockData).filter(
        StockData.symbol == symbol,
        StockData.date >= cutoff_date
    ).order_by(StockData.date).all()
    
    if not records:
        # If no data in DB, fetch from API
        df = fetch_stock_data(symbol, period=f"{min(days, 30)}d")
        if df is None:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        result = df.to_dict(orient="records")
    else:
        result = [
            {
                "date": r.date.isoformat(),
                "open": r.open,
                "high": r.high,
                "low": r.low,
                "close": r.close,
                "volume": r.volume,
                "daily_return": r.daily_return,
                "moving_avg_7": r.moving_avg_7,
                "week52_high": r.week52_high,
                "week52_low": r.week52_low,
                "volatility_score": r.volatility_score
            }
            for r in records
        ]
    
    cache[cache_key] = result
    return result

@app.get("/summary/{symbol}")
async def get_stock_summary(symbol: str, db: Session = Depends(get_db)):
    """Get 52-week high/low and average close"""
    cache_key = f"summary_{symbol}"
    if cache_key in cache:
        return cache[cache_key]
    
    # Get latest data
    latest = db.query(StockData).filter(
        StockData.symbol == symbol
    ).order_by(desc(StockData.date)).first()
    
    if not latest:
        raise HTTPException(status_code=404, detail="Symbol not found")
    
    # Calculate 52-week stats
    year_ago = datetime.now().date() - timedelta(days=365)
    
    stats = db.query(
        func.max(StockData.high).label('week52_high'),
        func.min(StockData.low).label('week52_low'),
        func.avg(StockData.close).label('avg_close')
    ).filter(
        StockData.symbol == symbol,
        StockData.date >= year_ago
    ).first()
    
    result = {
        "symbol": symbol,
        "current_price": latest.close,
        "week52_high": float(stats.week52_high) if stats.week52_high else 0,
        "week52_low": float(stats.week52_low) if stats.week52_low else 0,
        "average_close": float(stats.avg_close) if stats.avg_close else 0,
        "volatility": latest.volatility_score,
        "daily_return": latest.daily_return
    }
    
    cache[cache_key] = result
    return result

@app.get("/compare")
async def compare_stocks(
    symbol1: str = Query(..., description="First stock symbol"),
    symbol2: str = Query(..., description="Second stock symbol"),
    days: int = Query(30, description="Number of days to compare")
):
    """Compare two stocks' performance"""
    cache_key = f"compare_{symbol1}_{symbol2}_{days}"
    if cache_key in cache:
        return cache[cache_key]
    
    # Fetch data for both stocks
    data1 = fetch_stock_data(symbol1, period=f"{min(days, 90)}d")
    data2 = fetch_stock_data(symbol2, period=f"{min(days, 90)}d")
    
    if data1 is None or data2 is None:
        raise HTTPException(status_code=404, detail="One or both symbols not found")
    
    # Calculate correlation
    correlation = np.corrcoef(data1['Close'].values, data2['Close'].values)[0, 1]
    
    # Calculate performance metrics
    perf1 = (data1['Close'].iloc[-1] - data1['Close'].iloc[0]) / data1['Close'].iloc[0] * 100
    perf2 = (data2['Close'].iloc[-1] - data2['Close'].iloc[0]) / data2['Close'].iloc[0] * 100
    
    # Calculate volatility
    vol1 = data1['Daily_Return'].std() * 100
    vol2 = data2['Daily_Return'].std() * 100
    
    result = {
        "stocks": [symbol1, symbol2],
        "period_days": days,
        "correlation": float(correlation),
        "performance": {
            symbol1: float(perf1),
            symbol2: float(perf2)
        },
        "volatility": {
            symbol1: float(vol1),
            symbol2: float(vol2)
        },
        "current_prices": {
            symbol1: float(data1['Close'].iloc[-1]),
            symbol2: float(data2['Close'].iloc[-1])
        }
    }
    
    cache[cache_key] = result
    return result

@app.get("/top-gainers")
async def get_top_gainers(db: Session = Depends(get_db)):
    """Get top 5 gaining stocks"""
    cache_key = "top_gainers"
    if cache_key in cache:
        return cache[cache_key]
    
    # Get latest prices for all companies
    companies = db.query(Company).all()
    gainers = []
    
    for company in companies:
        # Get last 2 days of data
        data = db.query(StockData).filter(
            StockData.symbol == company.symbol
        ).order_by(desc(StockData.date)).limit(2).all()
        
        if len(data) >= 2:
            change = ((data[0].close - data[1].close) / data[1].close) * 100
            gainers.append({
                "symbol": company.symbol,
                "name": company.name,
                "current_price": data[0].close,
                "change_percent": float(change),
                "volume": data[0].volume
            })
    
    # Sort by gain
    gainers.sort(key=lambda x: x["change_percent"], reverse=True)
    
    result = gainers[:5]
    cache[cache_key] = result
    return result

@app.get("/top-losers")
async def get_top_losers(db: Session = Depends(get_db)):
    """Get top 5 losing stocks"""
    cache_key = "top_losers"
    if cache_key in cache:
        return cache[cache_key]
    
    # Get latest prices for all companies
    companies = db.query(Company).all()
    losers = []
    
    for company in companies:
        # Get last 2 days of data
        data = db.query(StockData).filter(
            StockData.symbol == company.symbol
        ).order_by(desc(StockData.date)).limit(2).all()
        
        if len(data) >= 2:
            change = ((data[0].close - data[1].close) / data[1].close) * 100
            losers.append({
                "symbol": company.symbol,
                "name": company.name,
                "current_price": data[0].close,
                "change_percent": float(change),
                "volume": data[0].volume
            })
    
    # Sort by loss
    losers.sort(key=lambda x: x["change_percent"])
    
    result = losers[:5]
    cache[cache_key] = result
    return result

@app.get("/sectors")
async def get_sectors(db: Session = Depends(get_db)):
    """Get all sectors with average performance"""
    sectors = {}
    
    companies = db.query(Company).all()
    
    for company in companies:
        if company.sector not in sectors:
            sectors[company.sector] = {"companies": [], "avg_change": 0}
        
        # Get last 2 days of data
        data = db.query(StockData).filter(
            StockData.symbol == company.symbol
        ).order_by(desc(StockData.date)).limit(2).all()
        
        if len(data) >= 2:
            change = ((data[0].close - data[1].close) / data[1].close) * 100
            sectors[company.sector]["companies"].append({
                "symbol": company.symbol,
                "name": company.name,
                "change": float(change)
            })
    
    # Calculate average change per sector
    for sector, data in sectors.items():
        if data["companies"]:
            avg_change = sum(c["change"] for c in data["companies"]) / len(data["companies"])
            sectors[sector]["avg_change"] = float(avg_change)
    
    return sectors