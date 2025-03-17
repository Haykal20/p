const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signUpButton.addEventListener('click', () => {
    container.classList.add('right-panel-active');
});

signInButton.addEventListener('click', () => {
    container.classList.remove('right-panel-active');
});

document.getElementById('signInForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const identifier = event.target.querySelector('input[name="identifier"]').value;
    const password = event.target.querySelector('input[type="password"]').value;

    try {
        const response = await fetch('/signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ identifier, password })
        });

        if (response.ok) {
            window.location.href = '/profile';
        } else {
            const result = await response.json();
            alert(result.message);
        }
    } catch (error) {
        alert('An error occurred during sign in');
    }
});

document.getElementById('signUpForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const password = event.target.querySelector('input[name="password"]').value;
    const confirmPassword = event.target.querySelector('input[name="confirmPassword"]').value;
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    const name = event.target.querySelector('input[name="name"]').value;
    const username = event.target.querySelector('input[name="username"]').value;
    const nim = event.target.querySelector('input[name="nim"]').value;
    const email = event.target.querySelector('input[name="email"]').value;

    const response = await fetch('/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, name, nim, email, password })
    });

    const result = await response.json();
    alert(result.message);
});

// Add reset password functionality
if (document.getElementById('resetPasswordLink')) {
    document.getElementById('resetPasswordLink').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('signInForm').style.display = 'none';
        document.getElementById('resetPasswordForm').style.display = 'flex';
    });
}

if (document.getElementById('backToSignIn')) {
    document.getElementById('backToSignIn').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('resetPasswordForm').style.display = 'none';
        document.getElementById('signInForm').style.display = 'flex';
    });
}

if (document.getElementById('resetPasswordForm')) {
    document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = e.target.querySelector('input[name="resetEmail"]').value;
        const newPassword = e.target.querySelector('input[name="newPassword"]').value;
        const confirmNewPassword = e.target.querySelector('input[name="confirmNewPassword"]').value;
        
        if (newPassword !== confirmNewPassword) {
            alert('Passwords do not match');
            return;
        }
        
        try {
            const response = await fetch('/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, newPassword })
            });
            
            const result = await response.json();
            alert(result.message);
            
            if (response.ok) {
                document.getElementById('resetPasswordSection').style.display = 'none';
                document.getElementById('signInForm').style.display = 'block';
            }
        } catch (error) {
            alert('Error resetting password');
        }
    });
}

// Reset password functionality
document.getElementById('resetPasswordLink').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('signInForm').style.display = 'none';
    document.getElementById('resetPasswordSection').style.display = 'flex';
});

document.getElementById('backToSignIn').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('resetPasswordSection').style.display = 'none';
    document.getElementById('signInForm').style.display = 'flex';
});

document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = e.target.querySelector('input[name="resetEmail"]').value;
    const newPassword = e.target.querySelector('input[name="newPassword"]').value;
    const confirmNewPassword = e.target.querySelector('input[name="confirmNewPassword"]').value;
    
    if (newPassword !== confirmNewPassword) {
        alert('Passwords do not match');
        return;
    }
    
    try {
        const response = await fetch('/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, newPassword })
        });
        
        const result = await response.json();
        alert(result.message);
        
        if (response.ok) {
            document.getElementById('resetPasswordSection').style.display = 'none';
            document.getElementById('signInForm').style.display = 'flex';
        }
    } catch (error) {
        alert('Error resetting password');
    }
});
