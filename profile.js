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
    const input = document.getElementById('photoInput');
    input.click();
});

document.getElementById('photoInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        alert('Please select an image file (JPG, PNG, or GIF)');
        return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    try {
        const changePhotoBtn = document.getElementById('changePhotoBtn');
        changePhotoBtn.textContent = 'Uploading...';
        changePhotoBtn.disabled = true;

        const response = await fetch('/update-photo', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            const photoUrl = result.photoUrl || `/uploads/${result.photo}`;
            const userPhoto = document.getElementById('userPhoto');
            userPhoto.src = photoUrl + '?t=' + new Date().getTime(); // Add cache buster
            console.log('Photo updated successfully:', photoUrl);
        } else {
            alert('Failed to update photo');
        }
    } catch (error) {
        alert('Error uploading photo');
        console.error('Upload error:', error);
    } finally {
        changePhotoBtn.textContent = 'Change Profile Photo';
        changePhotoBtn.disabled = false;
    }
});
