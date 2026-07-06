jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
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

import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

const initWbotMock = initWbot as jest.Mock;
const removeWbotMock = removeWbot as jest.Mock;
const findWhatsappMock = Whatsapp.findByPk as jest.Mock;
const getIOMock = getIO as jest.Mock;
const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
const wbotMonitorMock = wbotMonitor as jest.Mock;

describe("StartWhatsAppSessionVerify", () => {
  const wbot = { id: 10 };
  let callOrder: string[];

  const buildWhatsapp = () =>
    ({
      id: 10,
      tenantId: 1,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    callOrder = [];
    jest.clearAllMocks();

    getIOMock.mockReturnValue({ emit: jest.fn() });
    removeWbotMock.mockImplementation(() => {
      callOrder.push("removeWbot");
    });
    initWbotMock.mockImplementation(async () => {
      callOrder.push("initWbot");
      return wbot;
    });
  });

  it("replaces stale session when sendSeen fails with disconnected client", async () => {
    const whatsapp = buildWhatsapp();
    findWhatsappMock.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["removeWbot", "initWbot"]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
  });
});

describe("StartWhatsAppSession", () => {
  const wbot = { id: 10 };
  let callOrder: string[];

  const buildWhatsapp = () =>
    ({
      id: 10,
      tenantId: 1,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    callOrder = [];
    jest.clearAllMocks();

    getIOMock.mockReturnValue({ emit: jest.fn() });
    removeWbotMock.mockImplementation(() => {
      callOrder.push("removeWbot");
    });
    initWbotMock.mockImplementation(async () => {
      callOrder.push("initWbot");
      return wbot;
    });
  });

  it("replaces stale session before opening a whatsapp client", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["removeWbot", "initWbot"]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
