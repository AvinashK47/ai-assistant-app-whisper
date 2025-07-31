async function getUserPermission(){
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Permission for mic granted.");
    return stream;
  }
  catch (error) {
    console.error("Permission Denied , user denied/blocked the request. ", error);
    alert("You must allow the microphone access to record audio");
  }
}