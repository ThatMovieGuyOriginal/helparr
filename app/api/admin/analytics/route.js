// app/api/admin/analytics/route.js

export async function GET() {
  // In production, pull from your analytics DB
  // For now, return mock data showing the problem
  
  const data = {
    funnel: {
      pageViews: 1100,
      demoInteractions: 825,
      setupStarted: 550,
      setupCompleted: 483,
      firstSearch: 142,
      rssGenerated: 15,
      activeUsers: 15
    },
    dropoffAnalysis: [
      { stage: 'Demo → Setup', lost: 275, percentage: 25 },
      { stage: 'Setup → Complete', lost: 67, percentage: 12 },
      { stage: 'Complete → Search', lost: 341, percentage: 71 }, // THE PROBLEM
      { stage: 'Search → RSS', lost: 127, percentage: 89 }
    ]
  };
  
  return Response.json(data);
}
