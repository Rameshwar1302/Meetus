import { useEffect, useRef, useState } from "react";

const useLocalMedia = () => {
    const streamRef = useRef(null);

    const [stream, setStream] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const startMedia = async () => {
            try {
                setLoading(true);
                setError("");

                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error(
                        "Camera and microphone are not supported by this browser"
                    );
                }

                const mediaStream =
                    await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true
                    });

                if (cancelled) {
                    mediaStream.getTracks().forEach(
                        (track) => track.stop()
                    );
                    return;
                }

                streamRef.current = mediaStream;
                setStream(mediaStream);

            } catch (error) {
                console.error(
                    "Failed to access camera/microphone:",
                    error
                );

                if (error.name === "NotAllowedError") {
                    setError(
                        "Camera or microphone permission was denied."
                    );
                } else if (error.name === "NotFoundError") {
                    setError(
                        "No camera or microphone was found."
                    );
                } else if (error.name === "NotReadableError") {
                    setError(
                        "Camera or microphone is already being used by another application."
                    );
                } else {
                    setError(
                        error.message ||
                        "Failed to access camera and microphone."
                    );
                }

            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        startMedia();

        return () => {
            cancelled = true;

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(
                    (track) => track.stop()
                );

                streamRef.current = null;
            }
        };
    }, []);

    return {
        stream,
        loading,
        error
    };
};

export default useLocalMedia;