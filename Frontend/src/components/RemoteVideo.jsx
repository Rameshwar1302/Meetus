import { useEffect, useRef } from "react";
import { MicOff } from "lucide-react";

const RemoteVideo = ({
    stream,
    name = "Participant",
    micOff = false,
    cameraOff = false,
    sharing = false,
    status,
}) => {
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

        const noVideo = !stream || stream.getVideoTracks().length === 0;
    const showAvatar = (cameraOff || noVideo) && !sharing;
    const unstable = status && status !== "connected";

    return (
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-stone-200 ring-1 ring-stone-200">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`h-full w-full ${
                    sharing ? "object-contain" : "object-cover"
                }`}
            />

            {showAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-200">
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl font-semibold text-stone-700 shadow-sm">
                        {(name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                </div>
            )}

            {unstable && (
                <span className="absolute left-3 top-3 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                    {status === "disconnected" ? "Reconnecting..." : "Connecting..."}
                </span>
            )}

            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-stone-800">
                {micOff && <MicOff size={12} className="text-red-600" />}
                <span>{sharing ? `${name} (sharing screen)` : name}</span>
            </div>
        </div>
    );
};

export default RemoteVideo;