jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation(() => ({
    adapter: jest.fn(),
    use: jest.fn(),
    on: jest.fn()
  }))
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

import { Server as SocketIOServer } from "socket.io";
import decodeTokenSocket from "../../../libs/decodeTokenSocket";
import User from "../../../models/User";
import { initIO } from "../../../libs/socket";

describe("initIO socket authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("permite token valido chamando next apenas uma vez sem erro", async () => {
    const authenticatedUser = {
      id: 42,
      tenantId: 7,
      name: "Atendente"
    };
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: true,
      data: {
        id: 42,
        profile: "admin",
        tenantId: 7
      }
    });
    (User.findByPk as jest.Mock).mockResolvedValue(authenticatedUser);

    initIO({} as any);

    const socketServer = (SocketIOServer as unknown as jest.Mock).mock
      .results[0].value;
    const middleware = socketServer.use.mock.calls[0][0];
    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {
          token: "valid-token",
          keep: "same-value"
        }
      },
      emit: jest.fn()
    };

    await middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.handshake.auth).toEqual(
      expect.objectContaining({
        token: "valid-token",
        keep: "same-value",
        id: "42",
        tenantId: "7",
        profile: "admin",
        user: authenticatedUser
      })
    );
    expect(User.findByPk).toHaveBeenCalledWith(42, {
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
  });

  it("rejeita token invalido com erro de autenticacao", async () => {
    (decodeTokenSocket as jest.Mock).mockReturnValue({
      isValid: false,
      data: {
        id: "",
        profile: "",
        tenantId: 0
      }
    });

    initIO({} as any);

    const socketServer = (SocketIOServer as unknown as jest.Mock).mock
      .results[0].value;
    const middleware = socketServer.use.mock.calls[0][0];
    const next = jest.fn();

    await middleware(
      {
        handshake: {
          auth: {
            token: "invalid-token"
          }
        },
        emit: jest.fn()
      },
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toEqual(new Error("authentication error"));
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});
