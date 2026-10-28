import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

const mockEmit = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
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

jest.mock(
  "../../../services/InstagramBotServices/StartInstaBotSession",
  () => ({
    StartInstaBotSession: jest.fn()
  })
);

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock(
  "../../../services/MessengerChannelServices/StartMessengerBot",
  () => ({
    StartMessengerBot: jest.fn()
  })
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("WhatsApp session recovery", () => {
  const mockInitWbot = initWbot as jest.MockedFunction<typeof initWbot>;
  const mockRemoveWbot = removeWbot as jest.MockedFunction<typeof removeWbot>;
  const mockGetIO = getIO as jest.MockedFunction<typeof getIO>;
  const mockFindByPk = Whatsapp.findByPk as jest.Mock;
  const mockWbot = { id: 42 } as any;

  beforeEach(() => {
    mockEmit.mockClear();
    mockInitWbot.mockResolvedValue(mockWbot);
    mockRemoveWbot.mockResolvedValue(undefined);
    mockGetIO.mockReturnValue({ emit: mockEmit } as any);
    (wbotMessageListener as jest.Mock).mockClear();
    (wbotMonitor as jest.Mock).mockClear();
  });

  it("removes an existing WhatsApp client before starting a session", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    await StartWhatsAppSession(whatsapp as any);

    expect(mockRemoveWbot).toHaveBeenCalledWith(42);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(wbotMessageListener).toHaveBeenCalledWith(mockWbot);
    expect(wbotMonitor).toHaveBeenCalledWith(mockWbot, whatsapp);
  });

  it("recovers from sendSeen session errors by replacing the registered client", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };

    mockFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      42,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(mockFindByPk).toHaveBeenCalledWith(42);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("7:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(42);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
  });
});
