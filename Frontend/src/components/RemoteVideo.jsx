import { useEffect, useRef } from "react";

const RemoteVideo = ({ stream }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoRef.current) {
            return;
        }

        videoRef.current.srcObject = stream;

        return () => {
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
                width: "480px",
                maxWidth: "100%",
                borderRadius: "12px",
                background: "black"
            }}
        />
    );
};

export default RemoteVideo;