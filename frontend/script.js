// Configuration
const API_BASE_URL = 'http://127.0.0.1:8000'; // Change this to your Render URL when deploying
let currentStock = null;
let priceChart = null;
let returnsChart = null;
let comparisonChart = null;

// DOM Elements
const companiesList = document.getElementById('companiesList');
const searchCompany = document.getElementById('searchCompany');
const timePeriod = document.getElementById('timePeriod');
const compareStock = document.getElementById('compareStock');
const compareBtn = document.getElementById('compareBtn');
const refreshData = document.getElementById('refreshData');
const closeComparison = document.getElementById('closeComparison');
const apiStatus = document.getElementById('apiStatus');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    checkAPIStatus();
    loadCompanies();
    loadTopGainers();
    loadTopLosers();
    updateLastUpdated();
    
    // Set up event listeners
    searchCompany.addEventListener('input', filterCompanies);
    timePeriod.addEventListener('change', () => {
        if (currentStock) {
            loadStockData(currentStock);
        }
    });
    compareBtn.addEventListener('click', compareStocks);
    refreshData.addEventListener('click', refreshAllData);
    closeComparison.addEventListener('click', () => {
        document.getElementById('comparisonSection').style.display = 'none';
    });
    
    // Auto-refresh data every 5 minutes
    setInterval(refreshAllData, 5 * 60 * 1000);
});

// API Status Check
async function checkAPIStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        if (response.ok) {
            apiStatus.textContent = 'Online';
            apiStatus.className = 'api-status';
        } else {
            apiStatus.textContent = 'Offline';
            apiStatus.className = 'api-status offline';
        }
    } catch (error) {
        apiStatus.textContent = 'Offline';
        apiStatus.className = 'api-status offline';
    }
}

// Load Companies
async function loadCompanies() {
    try {
        const response = await fetch(`${API_BASE_URL}/companies`);
        const companies = await response.json();
        
        displayCompanies(companies);
        populateCompareDropdown(companies);
        updateCompanyStats(companies);
    } catch (error) {
        companiesList.innerHTML = '<div class="error">Failed to load companies</div>';
        console.error('Error loading companies:', error);
    }
}

function displayCompanies(companies) {
    companiesList.innerHTML = '';
    
    companies.forEach(company => {
        const companyElement = document.createElement('div');
        companyElement.className = 'company-item';
        companyElement.dataset.symbol = company.symbol;
        
        companyElement.innerHTML = `
            <div class="company-name">${company.name}</div>
            <div class="company-symbol">${company.symbol.replace('.NS', '')}</div>
            <div class="company-sector">${company.sector}</div>
        `;
        
        companyElement.addEventListener('click', () => {
            // Remove active class from all companies
            document.querySelectorAll('.company-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Add active class to clicked company
            companyElement.classList.add('active');
            
            // Load stock data
            loadStockData(company.symbol);
        });
        
        companiesList.appendChild(companyElement);
    });
    
    // Select first company by default
    if (companies.length > 0) {
        const firstCompany = document.querySelector('.company-item');
        if (firstCompany) {
            firstCompany.click();
        }
    }
}

function filterCompanies() {
    const searchTerm = searchCompany.value.toLowerCase();
    const companies = document.querySelectorAll('.company-item');
    
    companies.forEach(company => {
        const name = company.querySelector('.company-name').textContent.toLowerCase();
        const symbol = company.querySelector('.company-symbol').textContent.toLowerCase();
        const sector = company.querySelector('.company-sector').textContent.toLowerCase();
        
        if (name.includes(searchTerm) || symbol.includes(searchTerm) || sector.includes(searchTerm)) {
            company.style.display = 'block';
        } else {
            company.style.display = 'none';
        }
    });
}

function populateCompareDropdown(companies) {
    compareStock.innerHTML = '<option value="">None</option>';
    
    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.symbol;
        option.textContent = `${company.name} (${company.symbol.replace('.NS', '')})`;
        compareStock.appendChild(option);
    });
}

function updateCompanyStats(companies) {
    document.getElementById('totalCompanies').textContent = companies.length;
    
    // Count unique sectors
    const sectors = new Set(companies.map(c => c.sector));
    document.getElementById('totalSectors').textContent = sectors.size;
}

// Load Stock Data
async function loadStockData(symbol) {
    currentStock = symbol;
    
    try {
        const days = timePeriod.value;
        const [dataResponse, summaryResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/data/${symbol}?days=${days}`),
            fetch(`${API_BASE_URL}/summary/${symbol}`)
        ]);
        
        const stockData = await dataResponse.json();
        const stockSummary = await summaryResponse.json();
        
        updateStockInfo(stockSummary);
        updateCharts(stockData);
        updateMetrics(stockSummary);
    } catch (error) {
        console.error('Error loading stock data:', error);
        document.getElementById('selectedStockInfo').innerHTML = 
            '<p class="error">Failed to load stock data. Please try again.</p>';
    }
}

function updateStockInfo(summary) {
    const stockInfoDiv = document.getElementById('selectedStockInfo');
    const change = summary.daily_return ? (summary.daily_return * 100).toFixed(2) : 0;
    const changeClass = change >= 0 ? 'change-positive' : 'change-negative';
    const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    
    // Extract company name from symbol
    const companyName = summary.symbol.split('.')[0];
    
    stockInfoDiv.innerHTML = `
        <div class="stock-header">
            <h3>${companyName}</h3>
            <div class="stock-price">₹${summary.current_price?.toFixed(2) || 'N/A'}</div>
            <div class="stock-change ${changeClass}">
                <i class="fas ${changeIcon}"></i>
                ${Math.abs(change)}% Today
            </div>
        </div>
        <div class="stock-details">
            <p>Symbol: <strong>${summary.symbol}</strong></p>
            <p>52-Week Range: ₹${summary.week52_low?.toFixed(2) || 'N/A'} - ₹${summary.week52_high?.toFixed(2) || 'N/A'}</p>
        </div>
    `;
}

function updateCharts(stockData) {
    // Prepare data for charts
    const dates = stockData.map(d => new Date(d.date).toLocaleDateString());
    const prices = stockData.map(d => d.close);
    const movingAverages = stockData.map(d => d.moving_avg_7);
    const dailyReturns = stockData.map(d => d.daily_return ? d.daily_return * 100 : 0);
    
    // Update Price Chart
    const priceCtx = document.getElementById('priceChart').getContext('2d');
    
    if (priceChart) {
        priceChart.destroy();
    }
    
    priceChart = new Chart(priceCtx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Closing Price',
                    data: prices,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '7-Day Moving Average',
                    data: movingAverages,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Price (₹)'
                    }
                }
            }
        }
    });
    
    // Update Returns Chart
    const returnsCtx = document.getElementById('returnsChart').getContext('2d');
    
    if (returnsChart) {
        returnsChart.destroy();
    }
    
    returnsChart = new Chart(returnsCtx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Daily Return (%)',
                data: dailyReturns,
                backgroundColor: dailyReturns.map(r => r >= 0 ? 'rgba(76, 175, 80, 0.7)' : 'rgba(244, 67, 54, 0.7)'),
                borderColor: dailyReturns.map(r => r >= 0 ? '#4CAF50' : '#f44336'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Return (%)'
                    }
                }
            }
        }
    });
}

function updateMetrics(summary) {
    document.getElementById('weekHigh').textContent = summary.week52_high ? `₹${summary.week52_high.toFixed(2)}` : '-';
    document.getElementById('weekLow').textContent = summary.week52_low ? `₹${summary.week52_low.toFixed(2)}` : '-';
    document.getElementById('avgClose').textContent = summary.average_close ? `₹${summary.average_close.toFixed(2)}` : '-';
    document.getElementById('volatilityScore').textContent = summary.volatility ? `${summary.volatility.toFixed(2)}%` : '-';
}

// Load Top Gainers and Losers
async function loadTopGainers() {
    try {
        const response = await fetch(`${API_BASE_URL}/top-gainers`);
        const gainers = await response.json();
        
        const gainersDiv = document.getElementById('topGainers');
        gainersDiv.innerHTML = '';
        
        gainers.forEach(gainer => {
            const gainerElement = document.createElement('div');
            gainerElement.className = 'performance-item';
            gainerElement.innerHTML = `
                <div class="stock-info">
                    <div class="stock-name">${gainer.name}</div>
                    <div class="stock-symbol">${gainer.symbol.replace('.NS', '')}</div>
                </div>
                <div class="stock-change positive">+${gainer.change_percent.toFixed(2)}%</div>
            `;
            gainersDiv.appendChild(gainerElement);
        });
    } catch (error) {
        console.error('Error loading gainers:', error);
    }
}

async function loadTopLosers() {
    try {
        const response = await fetch(`${API_BASE_URL}/top-losers`);
        const losers = await response.json();
        
        const losersDiv = document.getElementById('topLosers');
        losersDiv.innerHTML = '';
        
        losers.forEach(loser => {
            const loserElement = document.createElement('div');
            loserElement.className = 'performance-item';
            loserElement.innerHTML = `
                <div class="stock-info">
                    <div class="stock-name">${loser.name}</div>
                    <div class="stock-symbol">${loser.symbol.replace('.NS', '')}</div>
                </div>
                <div class="stock-change negative">${loser.change_percent.toFixed(2)}%</div>
            `;
            losersDiv.appendChild(loserElement);
        });
    } catch (error) {
        console.error('Error loading losers:', error);
    }
}

// Compare Stocks
async function compareStocks() {
    const symbol2 = compareStock.value;
    
    if (!currentStock || !symbol2) {
        alert('Please select a stock to compare with');
        return;
    }
    
    try {
        const days = timePeriod.value;
        const response = await fetch(`${API_BASE_URL}/compare?symbol1=${currentStock}&symbol2=${symbol2}&days=${days}`);
        const comparison = await response.json();
        
        displayComparison(comparison);
    } catch (error) {
        console.error('Error comparing stocks:', error);
        alert('Failed to compare stocks. Please try again.');
    }
}

function displayComparison(comparison) {
    // Update comparison stats
    document.getElementById('correlationValue').textContent = comparison.correlation.toFixed(3);
    
    const perfDiff = comparison.performance[comparison.stocks[0]] - comparison.performance[comparison.stocks[1]];
    document.getElementById('perfDifference').textContent = `${perfDiff.toFixed(2)}%`;
    
    // Show comparison section
    const comparisonSection = document.getElementById('comparisonSection');
    comparisonSection.style.display = 'block';
    
    // Create comparison chart
    const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');
    
    if (comparisonChart) {
        comparisonChart.destroy();
    }
    
    // Fetch data for both stocks to create chart
    Promise.all([
        fetch(`${API_BASE_URL}/data/${comparison.stocks[0]}?days=${comparison.period_days}`),
        fetch(`${API_BASE_URL}/data/${comparison.stocks[1]}?days=${comparison.period_days}`)
    ])
    .then(async ([res1, res2]) => {
        const data1 = await res1.json();
        const data2 = await res2.json();
        
        const dates = data1.map(d => new Date(d.date).toLocaleDateString());
        const prices1 = data1.map(d => d.close);
        const prices2 = data2.map(d => d.close);
        
        // Normalize prices to percentage change for better comparison
        const base1 = prices1[0];
        const base2 = prices2[0];
        const normalized1 = prices1.map(p => ((p - base1) / base1) * 100);
        const normalized2 = prices2.map(p => ((p - base2) / base2) * 100);
        
        comparisonChart = new Chart(comparisonCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: comparison.stocks[0].replace('.NS', ''),
                        data: normalized1,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: comparison.stocks[1].replace('.NS', ''),
                        data: normalized2,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Normalized Performance (%)'
                        }
                    }
                }
            }
        });
    })
    .catch(error => {
        console.error('Error creating comparison chart:', error);
    });
}

// Utility Functions
function refreshAllData() {
    if (currentStock) {
        loadStockData(currentStock);
    }
    loadCompanies();
    loadTopGainers();
    loadTopLosers();
    updateLastUpdated();
}

function updateLastUpdated() {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('lastUpdated').textContent = `Updated: ${formattedTime}`;
}