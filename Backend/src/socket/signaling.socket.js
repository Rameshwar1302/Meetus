export const registerSignalingHandlers = (
    io,
    socket
) => {

    socket.on(
        "signal",
        ({ to, data }, callback) => {

            const meetingId =
                socket.data.meetingId;


            if (!meetingId) {

                return callback?.({
                    success: false,
                    message:
                        "You are not in a meeting"
                });
            }


            const targetSocket =
                io.sockets.sockets.get(to);


            if (!targetSocket) {

                return callback?.({
                    success: false,
                    message:
                        "Target socket not found"
                });
            }


            // Make sure target is in same meeting
            if (
                targetSocket.data.meetingId !==
                meetingId
            ) {

                return callback?.({
                    success: false,
                    message:
                        "Target is not in the same meeting"
                });
            }


            io.to(to).emit("signal", {

                from: socket.id,

                data

            });


            callback?.({
                success: true
            });

        }
    );

};