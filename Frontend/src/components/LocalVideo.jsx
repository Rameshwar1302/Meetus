import { useEffect, useRef } from "react";

const LocalVideo = ({ stream }) => {

    const videoRef = useRef(null);

    useEffect(() => {

        if (!videoRef.current) {
            return;
        }

        videoRef.current.srcObject =
            stream || null;

    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            muted
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

export default LocalVideo;