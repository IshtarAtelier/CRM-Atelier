import fetch from 'node-fetch';

(async () => {
    try {
        console.log('Fetching CSRF token...');
        // First get CSRF token from NextAuth
        const csrfRes = await fetch('https://grupooptico.dyndns.info/smartlab/api/auth/csrf');
        const csrfData = await csrfRes.json();
        const csrfToken = csrfData.csrfToken;
        const cookies = csrfRes.headers.raw()['set-cookie'] || [];
        
        let cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
        console.log('CSRF Token:', csrfToken);
        console.log('Initial Cookies:', cookieStr);

        console.log('Logging in...');
        const loginData = new URLSearchParams({
            csrfToken: csrfToken,
            username: 'pisano.ishtar@gmail.com',
            password: 'atelier',
            redirect: 'false'
        });

        const loginRes = await fetch('https://grupooptico.dyndns.info/smartlab/api/auth/callback/credentials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieStr,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            },
            body: loginData.toString()
        });

        const loginResData = await loginRes.json();
        console.log('Login Response:', loginResData);

        const loginCookies = loginRes.headers.raw()['set-cookie'] || [];
        const sessionCookie = loginCookies.find(c => c.includes('next-auth.session-token'));
        
        if (sessionCookie) {
            console.log('Session Cookie retrieved successfully!');
            cookieStr += '; ' + sessionCookie.split(';')[0];
            
            // Now let's try to get the Laboratory form or endpoint
            // Usually if it's TRPC or similar, we can intercept from the browser.
            // Let's just log success for now.
        } else {
            console.log('No session cookie found. Login might have failed.');
            console.log('Login Cookies:', loginCookies);
        }

    } catch (e) {
        console.error('Error:', e);
    }
})();
