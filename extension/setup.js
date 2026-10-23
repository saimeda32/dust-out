const result = document.getElementById('result');
document.getElementById('allow').addEventListener('click', async () => {
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: true });
    st.getTracks().forEach((t) => t.stop());
    result.textContent = 'Done. Close this tab and turn Hand gesture on again in your meeting.';
  } catch (e) {
    result.textContent = 'The camera was not allowed (' + e.name + '). Click the camera icon in the address bar to change it.';
  }
});
