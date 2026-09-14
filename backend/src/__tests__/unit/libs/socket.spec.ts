/* eslint-disable import/first, @typescript-eslint/no-explicit-any */

jest.mock("socket.io", () => ({
  Server: jest.fn()
}));

jest.mock("socket.io-redis", () => jest.fn(() => "redis-adapter"));

jest.mock("../../../libs/decodeTokenSocket", () => jest.fn());

jest.mock("../../../models/User", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../../libs/socketChat/Chat", () => ({
  register: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { Server as SocketServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import { initIO } from "../../../libs/socket";
import User from "../../../models/User";

const mockedSocketServer = SocketServer as unknown as jest.Mock;
const mockedDecodeTokenSocket = decodeTokenSocket as jest.Mock;
const mockedUser = User as jest.Mocked<typeof User>;

describe("socket", () => {
  const createIO = () => {
    let authMiddleware: any;
    const io = {
      adapter: jest.fn(),
      use: jest.fn(middleware => {
        authMiddleware = middleware;
      }),
      on: jest.fn(),
      to: jest.fn()
    };

    mockedSocketServer.mockImplementation(() => io);

    return {
      io,
      getAuthMiddleware: () => authMiddleware
    };
  };

  it("authenticates valid tokens without also returning an authentication error", async () => {
    const user = { id: 42, tenantId: 7, name: "Agent" };
    const { io, getAuthMiddleware } = createIO();
    mockedDecodeTokenSocket.mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        tenantId: 7
      }
    });
    mockedUser.findByPk.mockResolvedValue(user as any);

    initIO({} as any);

    const socket = {
      id: "socket-id",
      handshake: {
        auth: {
          token: "valid-token",
          existing: "kept"
        }
      },
      emit: jest.fn()
    };
    const next = jest.fn();

    await getAuthMiddleware()(socket, next);

    expect(io.adapter).toHaveBeenCalledWith("redis-adapter");
    expect(mockedDecodeTokenSocket).toHaveBeenCalledWith("valid-token");
    expect(mockedUser.findByPk).toHaveBeenCalledWith(42, {
      attributes: [
        "id",
        "tenantId",
        "name",
        "email",
        "profile",
        "status",
        "lastLogin",
        "lastOnline"
      ]
    });
    expect(socket.handshake.auth).toEqual({
      token: "valid-token",
      existing: "kept",
      id: "42",
      tenantId: "7",
      user
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
