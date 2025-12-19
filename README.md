# Trading Analytics Dashboard

A comprehensive analytics dashboard for analyzing Capital.com trading data. Import your CSV trading history to unlock detailed performance insights, visualizations, and key metrics.

## Features

### Key Metrics
- **Total P&L** - Overall profit/loss across all trades
- **Win Rate** - Percentage of profitable trades
- **Profit Factor** - Ratio of gross profit to gross loss
- **Expectancy** - Expected value per trade
- **Maximum Drawdown** - Largest peak-to-trough decline
- **Recovery Factor** - Total profit divided by max drawdown
- **Average Trade Duration** - Time between consecutive trades

### Visualizations
- **Equity Curve** - Cumulative P&L over time
- **Performance by Day** - Which days are most profitable
- **Performance by Hour** - Optimal trading times
- **Monthly Performance** - P&L breakdown by month
- **Long vs Short Analysis** - Direction comparison with win rates
- **Instrument Breakdown** - Performance per trading symbol

### Trade Log
- Complete trade history with sorting and search
- Detailed columns: Date, Instrument, Direction, Quantity, Price, Margin Used (with leverage), P&L, Fees, Net P&L, Return %
- Export to CSV functionality

### Filters
- Date range filtering
- Direction filtering (Long/Short)
- Instrument filtering
- Search by instrument, trade ID, or direction

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd capitalcom-trade-analytics-tool
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Usage

1. **Upload CSV File** - Click "Select CSV File" to import your Capital.com trade history
2. **View Analytics** - Dashboard automatically calculates and displays all metrics
3. **Filter Data** - Use the Filters button to narrow down specific date ranges, instruments, or directions
4. **Export Results** - Click "Export CSV" to download filtered results
5. **Search Trades** - Use the search bar in the trade log to find specific trades

### CSV Format

The dashboard expects Capital.com CSV exports with the following columns:
- Trade Id, Instrument Symbol, Quantity, Price
- Rpl Converted (Realized P&L), Fee, Swap Converted, Timestamp
- Take Profit, Stop Loss, Execution Type, Status

## Technologies

- **React 18** - UI framework
- **Vite** - Build tool
- **Recharts** - Data visualization
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## Leverage Calculation

The dashboard automatically estimates leverage based on instrument type:
- **Indices** (US100, SPX, DAX): 20:1
- **Forex** (EUR, USD, GBP): 30:1
- **Commodities** (GOLD, OIL, SILVER): 10:1
- **Default**: 20:1

Margin used is calculated as: `(Quantity × Price) / Leverage`

## Data Persistence

Trade data is automatically saved to browser localStorage, so your data persists between sessions. Use the "Clear" button to remove all stored data.

## License

MIT
