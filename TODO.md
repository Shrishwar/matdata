# TODO: Full-Stack Matka Prediction Web App

## Backend Updates
- [ ] Add /api/panels endpoint to return list of available panels
- [ ] Modify /api/history to accept ?panel=NAME parameter and filter results by panel
- [ ] Modify /api/predict to accept ?panel=NAME parameter and generate predictions for specific panel
- [ ] Update prediction engine to load data filtered by panel

## Frontend Updates
- [ ] Install and configure shadcn/ui components
- [ ] Update HomePage: Add dropdown for panel selection, show prediction card for selected panel
- [ ] Create ChartPage: Embed DPBoss chart iframe, add visualizations (charts for frequency, trends)
- [ ] Update HistoryPage: Add panel filter, show table for selected panel
- [ ] Remove old code and ensure production-ready

## Cleanup
- [ ] Remove any fake/old prediction code (seems already using DPBoss data)
- [ ] Ensure only DPBoss data is used

## Testing
- [ ] Test APIs with panel parameter
- [ ] Verify frontend UI with shadcn components
- [ ] Ensure production build works
