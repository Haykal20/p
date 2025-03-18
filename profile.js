window.addEventListener('load', async () => {
    try {
        const response = await fetch('/profile-data', {
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            const userData = await response.json();
            document.getElementById('userPhoto').src = `/uploads/${userData.photo}`;
            document.getElementById('userName').textContent = userData.name;
            document.getElementById('userEmail').textContent = userData.email;
            document.getElementById('userNim').textContent = `NIM: ${userData.nim}`;
        } else {
            console.error('Failed to fetch profile data');
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        window.location.href = '/';
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/logout');
    window.location.href = '/';
});

document.getElementById('changePhotoBtn').addEventListener('click', () => {
    document.getElementById('photoInput').click();
});

document.getElementById('photoInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('photo', file);

        const response = await fetch('/update-photo', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            document.getElementById('userPhoto').src = `/uploads/${result.photo}`;
        } else {
            alert('Failed to update photo');
        }
    }
});
