document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Initialize Charts (Empty at start)
    const ctxLayer = document.getElementById('layerChart').getContext('2d');
    const ctxBreach = document.getElementById('breachChart').getContext('2d');

    // Pie Chart Configuration
    const layerChart = new Chart(ctxLayer, {
        type: 'doughnut',
        data: {
            labels: ['Redis Database Block', 'AI Context Block', 'Legitimate Users'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#ff6b6b', '#9b59b6', '#1dd1a1'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // Bar Chart Configuration
    const breachChart = new Chart(ctxBreach, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Attacks Detected',
                data: [],
                backgroundColor: '#54a0ff',
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal Bar Chart
            responsive: true,
            scales: { x: { beginAtZero: true } }
        }
    });

    // Email Breach Bar Chart Configuration
    const ctxEmailBreach = document.getElementById('emailBreachChart').getContext('2d');
    const emailBreachChart = new Chart(ctxEmailBreach, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Email Breaches Detected',
                data: [],
                backgroundColor: '#ff9f43',
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal Bar Chart
            responsive: true,
            scales: { x: { beginAtZero: true } }
        }
    });

    // 2. Function to Fetch Data from Python
    async function updateDashboard() {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/stats');
            const data = await response.json();

            // Update Text Counters
            document.getElementById('total-val').textContent = data.total;
            document.getElementById('redis-val').textContent = data.breakdown.redis;
            document.getElementById('ai-val').textContent = data.breakdown.ai;
            document.getElementById('success-val').textContent = data.breakdown.success;
            document.getElementById('emails-checked-val').textContent = data.breakdown.emails_checked || 0;
            document.getElementById('emails-breached-val').textContent = data.breakdown.emails_breached || 0;

            // Update Pie Chart
            layerChart.data.datasets[0].data = [
                data.breakdown.redis,
                data.breakdown.ai,
                data.breakdown.success
            ];
            layerChart.update();

            // Update Breach Leaderboard (Bar Chart)
            const labels = data.leaderboard.map(item => item.name);
            const counts = data.leaderboard.map(item => item.count);

            breachChart.data.labels = labels;
            breachChart.data.datasets[0].data = counts;
            breachChart.update();

            // Update Email Breach Leaderboard
            if (data.email_leaderboard && data.email_leaderboard.length > 0) {
                const emailLabels = data.email_leaderboard.map(item => item.name);
                const emailCounts = data.email_leaderboard.map(item => item.count);

                emailBreachChart.data.labels = emailLabels;
                emailBreachChart.data.datasets[0].data = emailCounts;
                emailBreachChart.update();
            }

        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }

    // 3. Auto-Refresh Loop (Every 2 seconds)
    updateDashboard(); // Run once immediately
    setInterval(updateDashboard, 2000); // Then repeat
});
