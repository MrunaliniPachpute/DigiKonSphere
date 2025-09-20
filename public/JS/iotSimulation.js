// Simple LED simulation
const statusEl = document.getElementById('status');
if (statusEl) {
    if (statusEl.innerText === 'success') {
        statusEl.style.color = 'green';
    } else {
        statusEl.style.color = 'red';
    }
}
