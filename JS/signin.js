    // Show/hide password functionality
    document.getElementById('show-password').addEventListener('change', function() {
        const passwordInput = document.getElementById('password');
        passwordInput.type = this.checked ? 'text' : 'password';
    });

    // Sign in form submission
    document.getElementById('sign-in-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const credentials = btoa(`${username}:${password}`);

        try {
            const response = await fetch('https://learn.reboot01.com/api/auth/signin', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`
                }
            });
            console.log(username, password);

            if (!response.ok) {
                throw new Error('Invalid credentials');
            }

        // In login.js
        const token = await response.text();
        localStorage.setItem('token', token.replace(/"/g, '')); // Remove quotes

            window.location.href = 'dashboard.html'; // Redirect to dashboard
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    });