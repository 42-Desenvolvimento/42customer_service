import { initWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("StartWhatsAppSessionVerify", () => {
  const mockedInitWbot = initWbot as jest.Mock;
  const mockedGetIO = getIO as jest.Mock;
  const mockedWhatsapp = Whatsapp as unknown as { findByPk: jest.Mock };
  const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
  const mockedWbotMonitor = wbotMonitor as jest.Mock;
  const mockedLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupOpenSession = () => {
    const whatsapp = {
      id: 30,
      tenantId: 20,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const io = {
      emit: jest.fn()
    };
    const wbot = {
      id: 30
    };

    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);
    mockedGetIO.mockReturnValue(io);
    mockedInitWbot.mockResolvedValue(wbot);

    return {
      whatsapp,
      io,
      wbot
    };
  };

  it("should reopen whatsapp session when session is closed", async () => {
    const { whatsapp, io, wbot } = setupOpenSession();

    await StartWhatsAppSessionVerify(30, "Session closed");

    expect(mockedWhatsapp.findByPk).toHaveBeenCalledWith(30);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(io.emit).toHaveBeenCalledWith("20:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("should reopen whatsapp session when sendSeen fails because session is disconnected", async () => {
    setupOpenSession();

    await StartWhatsAppSessionVerify(
      30,
      new TypeError(
        "Cannot read property 'sendSeen' of undefined"
      ) as unknown as string
    );

    expect(mockedWhatsapp.findByPk).toHaveBeenCalledWith(30);
    expect(mockedInitWbot).toHaveBeenCalled();
  });

  it("should ignore errors that do not indicate a closed whatsapp session", async () => {
    await StartWhatsAppSessionVerify(30, "rate limited");

    expect(mockedWhatsapp.findByPk).not.toHaveBeenCalled();
    expect(mockedInitWbot).not.toHaveBeenCalled();
  });

  it("should log reconnect errors without throwing", async () => {
    const reconnectError = new Error("failed to initialize");
    setupOpenSession();
    mockedInitWbot.mockRejectedValue(reconnectError);

    await expect(
      StartWhatsAppSessionVerify(30, "ERR_WAPP_NOT_INITIALIZED")
    ).resolves.toBeUndefined();

    expect(mockedLogger.error).toHaveBeenCalledWith(reconnectError);
  });
});
