import { getHours } from "date-fns";
import { MissingValueError, pupa } from "../../../utils/pupa";

jest.mock("date-fns", () => ({
  getHours: jest.fn()
}));

const mockGetHours = getHours as jest.MockedFunction<typeof getHours>;

describe("pupa", () => {
  beforeEach(() => {
    mockGetHours.mockReturnValue(9);
  });

  it.each([
    [5, "Olá!"],
    [6, "Bom dia!"],
    [11, "Bom dia!"],
    [12, "Boa Tarde!"],
    [17, "Boa Tarde!"],
    [18, "Boa Noite!"],
    [23, "Boa Noite!"]
  ])("injects the greeting for hour %i", (hour, greeting) => {
    mockGetHours.mockReturnValue(hour);

    expect(pupa("{greeting} {contact.name}", { contact: { name: "Ana" } })).toBe(
      `${greeting} Ana`
    );
  });

  it("recomputes the greeting for each template render", () => {
    mockGetHours.mockReturnValueOnce(9).mockReturnValueOnce(20);

    expect(pupa("{greeting}", {})).toBe("Bom dia!");
    expect(pupa("{greeting}", {})).toBe("Boa Noite!");
  });

  it("keeps double-brace placeholders escaped", () => {
    expect(pupa("Mensagem: {{body}}", { body: "<b>olá</b>" })).toBe(
      "Mensagem: &lt;b&gt;olá&lt;/b&gt;"
    );
  });

  it("throws when a required placeholder is missing", () => {
    expect(() => pupa("Olá, {name}", {}, { ignoreMissing: false })).toThrow(
      MissingValueError
    );
  });
});
