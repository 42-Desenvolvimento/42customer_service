import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";

const mockEmit = jest.fn();

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: jest.fn()
}));

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock("../../../services/MessengerChannelServices/StartMessengerBot", () => ({
  StartMessengerBot: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const createWhatsapp = (): Whatsapp => {
  const whatsapp = {
    id: 7,
    tenantId: 3,
    type: "whatsapp",
    name: "Principal",
    status: "CONNECTED",
    retries: 0,
    session: null,
    update: jest.fn(async attrs => {
      Object.assign(whatsapp, attrs);
      return whatsapp;
    })
  };

  return whatsapp as unknown as Whatsapp;
};

describe("StartWhatsAppSession recovery", () => {
  const findByPkMock = Whatsapp.findByPk as jest.Mock;
  const getIOMock = getIO as jest.Mock;
  const initWbotMock = initWbot as jest.Mock;
  const removeWbotMock = removeWbot as jest.Mock;
  const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
  const wbotMonitorMock = wbotMonitor as jest.Mock;

  beforeEach(() => {
    mockEmit.mockClear();
    getIOMock.mockReturnValue({ emit: mockEmit });
    initWbotMock.mockResolvedValue({ id: 7 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("restarts the session when sendSeen fails with a disconnected client", async () => {
    const whatsapp = createWhatsapp();
    findByPkMock.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(removeWbotMock.mock.invocationCallOrder[0]).toBeLessThan(
      initWbotMock.mock.invocationCallOrder[0]
    );
    expect(wbotMessageListenerMock).toHaveBeenCalledWith({ id: 7 });
    expect(wbotMonitorMock).toHaveBeenCalledWith({ id: 7 }, whatsapp);
  });

  it("removes an existing whatsapp client before starting a new one", async () => {
    const whatsapp = createWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(removeWbotMock.mock.invocationCallOrder[0]).toBeLessThan(
      initWbotMock.mock.invocationCallOrder[0]
    );
  });
});
