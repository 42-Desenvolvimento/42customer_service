import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

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

const mockedWhatsapp = Whatsapp as unknown as {
  findByPk: jest.Mock;
};
const mockedGetIO = getIO as jest.Mock;
const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
const mockedWbotMonitor = wbotMonitor as jest.Mock;

const buildWhatsapp = () => ({
  id: 42,
  tenantId: 7,
  type: "whatsapp",
  update: jest.fn().mockResolvedValue(undefined)
});

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    mockedGetIO.mockReturnValue({ emit: jest.fn() });
    mockedInitWbot.mockResolvedValue({ id: 42 });
    mockedRemoveWbot.mockResolvedValue(undefined);
  });

  it("removes the stale session before reconnecting after a sendSeen failure", async () => {
    const whatsapp = buildWhatsapp();
    const calls: string[] = [];

    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);
    mockedRemoveWbot.mockImplementation(async () => {
      calls.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return { id: whatsapp.id };
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith({ id: whatsapp.id });
    expect(mockedWbotMonitor).toHaveBeenCalledWith(
      { id: whatsapp.id },
      whatsapp
    );
  });

  it("does not restart sessions for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(42, new Error("network timeout"));

    expect(mockedWhatsapp.findByPk).not.toHaveBeenCalled();
    expect(mockedRemoveWbot).not.toHaveBeenCalled();
    expect(mockedInitWbot).not.toHaveBeenCalled();
  });

  it("removes any registered client before a manual WhatsApp start", async () => {
    const whatsapp = buildWhatsapp();
    const calls: string[] = [];

    mockedRemoveWbot.mockImplementation(async () => {
      calls.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return { id: whatsapp.id };
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
  });
});
