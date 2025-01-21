document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token').replace(/"/g, '');  
    console.log("token", token);
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    async function loadDashboard() {
        try {
            const data = await makeGraphQLRequest(QUERY);
            console.log('API Response:', data);
            const user = data.data.user[0];
            displayUserInfo(user);
            fetchAuditsGiven(user.id);  
            displayAuditRatio(token, user.login);
            fetchXpPerProject();
        } catch (error) {
            console.error('Error:', error);
            if (error.response?.status === 401) {
                window.location.href = 'index.html';
            }
        }
    }

    const QUERY = `
        {
            user {
                id
                firstName
                lastName
                email
                login
                auditRatio
                campus
                transactions (where: {type: {_eq: "up"}}) {
                    amount
                    createdAt
                    path
                    objectId
                }
                
            }
        }
    `;

    async function makeGraphQLRequest(query, variables = {}) {
        const response = await fetch('https://learn.reboot01.com/api/graphql-engine/v1/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, variables })
        });

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`GraphQL error: ${responseText}`);
        }

        return JSON.parse(responseText);
    }

    // -------------------------------------XP Per Project------------------------------
    async function fetchXpPerProject() {
        const query = `
        query {
            transaction(where: {
                type: {_eq: "xp"},
                object: {
                    type: {_eq: "project"}
                }
            }) {
                amount
                path
                createdAt
                object {
                    name 
                    type
                }
            }
        }`;
     
        try {
            const data = await makeGraphQLRequest(query);
            // console.log(data);
            const transactions = data.data.transaction;
     
            const xpPerProj = {};
            transactions.forEach(t => {
                const projectPath = t.path;
                if (!xpPerProj[projectPath]) {
                    xpPerProj[projectPath] = 0;
                }
                xpPerProj[projectPath] += t.amount;
            });
     
            const chartData = Object.entries(xpPerProj)
                .map(([path, amount]) => ({
                    project: path.split('/').pop(),
                    xp: amount
                }))
                .sort((a, b) => b.xp - a.xp)
                .slice(0, 5);
    
            const svgContainer = document.getElementById('xp-chart');
            const width = svgContainer.clientWidth;
            const height = svgContainer.clientHeight;
            const margin = { top: 30, right: 30, bottom: 40, left: 150 };
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;
    
            const barHeight = chartHeight / 5;
            const maxXP = Math.max(...chartData.map(d => d.xp));
    
            let svg = `
            <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
                <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#BE185D" />
                        <stop offset="100%" stop-color="#EC4899" />
                    </linearGradient>
                </defs>
                <g transform="translate(${margin.left}, ${margin.top})">`;
    
            // X-axis 
            const xTicks = 5;
            for (let i = 0; i <= xTicks; i++) {
                const x = chartWidth * (i / xTicks);
                const xpValue = Math.round((maxXP * (i / xTicks)));
                svg += `
                    <line 
                        x1="${x}" 
                        y1="0" 
                        x2="${x}" 
                        y2="${chartHeight}" 
                        stroke="#374151" 
                        stroke-dasharray="2,2"
                    />
                    <text 
                        x="${x}" 
                        y="${chartHeight + 20}" 
                        text-anchor="middle"
                        fill="white"
                        class="text-xs"
                    >${xpValue.toLocaleString()}</text>
                `;
            }
    
            // Bars and labels
            chartData.forEach((d, i) => {
                const barWidth = (d.xp / maxXP) * chartWidth;
                svg += `
                    <g>
                        <rect
                            x="0"
                            y="${i * barHeight + 5}"
                            width="${barWidth}"
                            height="${barHeight - 10}"
                            fill="url(#barGradient)"
                            rx="4"
                            filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.1))"
                            class="transition-all duration-300 hover:opacity-80"
                        >
                            <title>${d.project}: ${d.xp.toLocaleString()} XP</title>
                        </rect>
                        <text
                            x="-10"
                            y="${i * barHeight + barHeight/2}"
                            text-anchor="end"
                            alignment-baseline="middle"
                            fill="white"
                            class="text-sm font-medium"
                        >${d.project}</text>
                    </g>
                `;
            });
    
            svg += `</g></svg>`;
            svgContainer.innerHTML = svg;
    
        } catch (error) {
            console.error('Error fetching XP per project:', error);
        }
    }
    // ---------------------------------------------------------------------------------

    // -------------------------------AUDITS DONE AND RECIEVED--------------------------
    async function fetchAuditsReceived(token, username) {
        const query = `{
            user(where: {login: {_eq: "${username}"}}) {
                transactions(
                    where: {
                        user: {login: {_eq: "${username}"}},
                        type: {_eq: "down"},
                        object: {type: {_eq: "project"}}
                    },
                    order_by: {createdAt: asc}
                ) {
                    amount
                    createdAt
                }
            }
        }`;
        
        const response = await fetch('https://learn.reboot01.com/api/graphql-engine/v1/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        return data.data.user[0].transactions;
    }
    async function fetchAuditsMade(token, username) {
        const query = `{
            user(where: {login: {_eq: "${username}"}}) {
                transactions(
                    where: {
                        user: {login: {_eq: "${username}"}},
                        type: {_eq: "up"},
                        object: {type: {_eq: "project"}}
                    },
                    order_by: {createdAt: asc}
                ) {
                    amount
                    createdAt
                }
            }
        }`;
        
        const response = await fetch('https://learn.reboot01.com/api/graphql-engine/v1/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        return data.data.user[0].transactions;
    }
    // adds all the audits
    function calculateTotalAmount(transactions) {
        return transactions.reduce((total, t) => total + t.amount, 0);
    }
    // calculates the ratio of the audits 
    function calculateRatio(auditsMade, auditsReceived) {
        if (auditsReceived === 0) return 0;
        return (auditsMade / auditsReceived).toFixed(2);
    }
    
    async function displayAuditRatio(token, username) {
        try {
            console.log('Fetching audits...');
            const auditsReceived = await fetchAuditsReceived(token, username);
            const auditsMade = await fetchAuditsMade(token, username);
            const totalReceived = calculateTotalAmount(auditsReceived);
            const totalMade = calculateTotalAmount(auditsMade);
            const ratio = calculateRatio(totalMade, totalReceived);
    
            document.getElementById('audit-made-value-right').textContent = `${(totalMade / 1000).toFixed(2)} KB`;
            document.getElementById('audit-received-value-right').textContent = `${(totalReceived / 1000).toFixed(2)} KB`;
            document.getElementById('audit-ratio').textContent = ratio;
            document.getElementById('audit-message').textContent = ratio < 1 ? 'Make more audits!' : 'Good job!';
    
            document.getElementById('audit-made-bar').style.width = `${(totalMade / (totalMade + totalReceived)) * 100}%`;
            document.getElementById('audit-received-bar').style.width = `${(totalReceived / (totalMade + totalReceived)) * 100}%`;
        } catch (error) {
            console.error('Error fetching audit data:', error);
        }
    }
    //------------------------------------------------------------------------------------------
    //---------------------------------------AUDITS CHART---------------------------------------
    async function fetchAuditsGiven(userid) {
        const query = `
            query FetchAudits($userid: Int!) {
                audit(where: {auditorId: {_eq: $userid}, grade: {_is_null: false}}) {
                    auditorId
                    grade
                }
            }
        `;

        const variables = { userid: parseInt(userid, 10) };  // make sure id is an int
        const data = await makeGraphQLRequest(query, variables);
        displayPieChart(data.data.audit);
        console.log("audits given", data);
    }

    async function displayPieChart(audits) {
        const svgContainer = document.getElementById('audit-chart');
        document.getElementById('totalAuditsDone').textContent = audits.length;
        
        const radius = Math.min(svgContainer.clientWidth, svgContainer.clientHeight) * 0.35;
        const centerX = svgContainer.clientWidth / 2;
        const centerY = svgContainer.clientHeight / 2;
    
        const passCount = audits.filter(audit => audit.grade >= 1).length;
        const failCount = audits.filter(audit => audit.grade < 1).length;
        const total = passCount + failCount;
        
        const passAngle = (passCount / total) * 360;
        const failAngle = (failCount / total) * 360;
    
        svgContainer.innerHTML = '';
        svgContainer.setAttribute('class', 'w-full h-full');
        
        // Add gradient definitions
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        
        // Pass gradient
        const passGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        passGradient.setAttribute("id", "passGradient");
        passGradient.innerHTML = `
            <stop offset="0%" stop-color="#EC4899" />
            <stop offset="100%" stop-color="#DB2777" />
        `;
        
        // Fail gradient
        const failGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        failGradient.setAttribute("id", "failGradient");
        failGradient.innerHTML = `
            <stop offset="0%" stop-color="#BE185D" />
            <stop offset="100%" stop-color="#9D174D" />
        `;
        
        defs.appendChild(passGradient);
        defs.appendChild(failGradient);
        svgContainer.appendChild(defs);
    
        // Background circle
        const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bgCircle.setAttribute("cx", centerX);
        bgCircle.setAttribute("cy", centerY);
        bgCircle.setAttribute("r", radius);
        bgCircle.setAttribute("fill", "#1F2937");
        svgContainer.appendChild(bgCircle);
    
        // Create and append pie slices with gradients
        const passSlice = createPieSlice(0, passAngle, radius, centerX, centerY, "url(#passGradient)");
        const failSlice = createPieSlice(passAngle, passAngle + failAngle, radius, centerX, centerY, "url(#failGradient)");
    
        passSlice.setAttribute("class", "transition-all duration-300 hover:opacity-90 cursor-pointer");
        failSlice.setAttribute("class", "transition-all duration-300 hover:opacity-90 cursor-pointer");
        
        svgContainer.appendChild(passSlice);
        svgContainer.appendChild(failSlice);
    
        // Add percentage labels
        const passPercentage = Math.round((passCount / total) * 100);
        const failPercentage = Math.round((failCount / total) * 100);
    
        // Center stats
        const centerStats = document.createElementNS("http://www.w3.org/2000/svg", "text");
        centerStats.setAttribute("x", centerX);
        centerStats.setAttribute("y", centerY);
        centerStats.setAttribute("text-anchor", "middle");
        centerStats.setAttribute("class", "font-bold text-xl fill-white");
        // centerStats.textContent = `${passPercentage}%`;
    
        // Labels with enhanced styling
        const passLabel = createLabel(centerX, centerY - radius - 20, 
            `Pass (${passCount})`, '#EC4899', `${passPercentage}%`);
        const failLabel = createLabel(centerX, centerY + radius + 20, 
            `Fail (${failCount})`, '#BE185D', `${failPercentage}%`);
    
        svgContainer.appendChild(centerStats);
        svgContainer.appendChild(passLabel);
        svgContainer.appendChild(failLabel);
    }
    
    function createPieSlice(startAngle, endAngle, radius, centerX, centerY, fillColor) {
        const startX = centerX + radius * Math.cos(Math.PI * startAngle / 180);
        const startY = centerY + radius * Math.sin(Math.PI * startAngle / 180);
        const endX = centerX + radius * Math.cos(Math.PI * endAngle / 180);
        const endY = centerY + radius * Math.sin(Math.PI * endAngle / 180);
    
        const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
        const pathData = [
            'M', centerX, centerY,
            'L', startX, startY,
            'A', radius, radius, 0, largeArcFlag, 1, endX, endY,
            'Z'
        ].join(' ');
    
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute('d', pathData);
        path.setAttribute('fill', fillColor);
        path.setAttribute('filter', 'drop-shadow(0 4px 6px rgb(0 0 0 / 0.3))');
    
        return path;
    }
    
    function createLabel(x, y, text, color) {
        const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Background rectangle
        const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const padding = 10;
        const width = text.length * 8 + padding * 2;
        bgRect.setAttribute("x", x - width / 2);
        bgRect.setAttribute("y", y - 15);
        bgRect.setAttribute("width", width);
        bgRect.setAttribute("height", 22);
        bgRect.setAttribute("rx", 4);
        bgRect.setAttribute("fill", "#1F2937");
        bgRect.setAttribute("filter", "drop-shadow(0 2px 4px rgb(0 0 0 / 0.1))");
        
        // Text label
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", x);
        label.setAttribute("y", y);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("fill", color);
        label.setAttribute("class", "font-medium text-sm");
        label.textContent = text;
    
        labelGroup.appendChild(bgRect);
        labelGroup.appendChild(label);
    
        return labelGroup;
    }
    //------------------------------------------------------------------------------------------

    function displayUserInfo(user) {
        document.getElementById('username').textContent = `${user.login}`;
        document.getElementById('email').textContent = `${user.email}`;
        document.getElementById('firstname').textContent = `${user.firstName}`;
        document.getElementById('campus').textContent = `${user.campus}`;
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });
    document.getElementById("profile-btn").addEventListener("click", () => {
        const dropdown = document.getElementById("profile-dropdown");
        dropdown.classList.toggle("hidden");
    });
    
    loadDashboard();
});
