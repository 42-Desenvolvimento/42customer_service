const mockEmit = jest.fn();
const mockInitialize = jest.fn();
const mockOn = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    on: mockOn
  })),
  DefaultOptions: {
    userAgent: "jest-user-agent"
  },
  LocalAuth: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({
    emit: mockEmit
  })
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
  jest.fn()
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: mockLoggerError,
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { initWbot } from "../../../libs/wbot";

describe("wbot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects when the whatsapp client initialize promise fails", async () => {
    const initializeError = new Error("chrome failed to start");
    mockInitialize.mockRejectedValue(initializeError);

    await expect(
      initWbot({
        id: 42,
        name: "support",
        tenantId: 7,
        session: null
      } as any)
    ).rejects.toThrow("chrome failed to start");

    expect(mockLoggerError).toHaveBeenCalledWith(
      `initWbot initialize error | Error: ${initializeError}`
    );
  });
});
