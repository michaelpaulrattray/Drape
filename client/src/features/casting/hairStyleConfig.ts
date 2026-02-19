/**
 * Hair style configuration data for ControlPanel.
 * Maps each hair style to its available options (lengths, textures, fringes, etc.)
 * and which genders it applies to.
 */

export interface HairStyleConfig {
  lengths?: string[];
  defaultLength?: string;
  textures?: string[];
  defaultTexture?: string;
  fringes?: string[];
  defaultFringe?: string;
  partings?: string[];
  volumes?: string[];
  gender: ('Female' | 'Male' | 'Non-Binary')[];
}

export const HAIR_STYLE_CONFIG: Record<string, HairStyleConfig> = {
  'Buzz / Shaved':    { gender: ['Female', 'Male', 'Non-Binary'], textures: ['Straight', 'Curly', 'Coily / Afro'] },
  'Pixie':            { gender: ['Female', 'Non-Binary'], lengths: ['Very Short', 'Short'], defaultLength: 'Short', textures: ['Straight', 'Slight Wave', 'Wavy', 'Curly'], defaultTexture: 'Slight Wave', fringes: ['None', 'Wispy Bangs', 'Side-Swept', 'Micro Fringe'], partings: ['Side', 'Deep Side', 'No Part / Slicked'] },
  'Cropped Bob':      { gender: ['Female', 'Non-Binary'], lengths: ['Very Short', 'Short'], defaultLength: 'Short', textures: ['Straight', 'Slight Wave', 'Wavy'], defaultTexture: 'Straight', fringes: ['None', 'Blunt Bangs', 'Micro Fringe', 'Wispy Bangs'], partings: ['Center', 'Slight Off-Center', 'Side'], volumes: ['Flat / Sleek', 'Natural'] },
  'Bob':              { gender: ['Female', 'Non-Binary'], lengths: ['Short', 'Medium'], defaultLength: 'Short', textures: ['Straight', 'Slight Wave', 'Wavy'], defaultTexture: 'Straight', fringes: ['None', 'Curtain Bangs', 'Blunt Bangs', 'Wispy Bangs', 'Side-Swept'], partings: ['Center', 'Slight Off-Center', 'Side'], volumes: ['Flat / Sleek', 'Natural', 'Voluminous'] },
  'Lob (Long Bob)':   { gender: ['Female', 'Non-Binary'], lengths: ['Medium', 'Long'], defaultLength: 'Medium', textures: ['Straight', 'Slight Wave', 'Wavy'], defaultTexture: 'Slight Wave', fringes: ['None', 'Curtain Bangs', 'Wispy Bangs', 'Side-Swept'], partings: ['Center', 'Slight Off-Center', 'Side', 'Deep Side'], volumes: ['Flat / Sleek', 'Natural', 'Voluminous', 'Face-Framing'] },
  'Medium Layers':    { gender: ['Female', 'Male', 'Non-Binary'], lengths: ['Medium', 'Long'], defaultLength: 'Medium', textures: ['Straight', 'Slight Wave', 'Wavy', 'Curly'], defaultTexture: 'Slight Wave', fringes: ['None', 'Curtain Bangs', 'Wispy Bangs', 'Side-Swept'], partings: ['Center', 'Slight Off-Center', 'Side', 'Deep Side'], volumes: ['Natural', 'Voluminous', 'Face-Framing'] },
  'Long Layers':      { gender: ['Female', 'Male', 'Non-Binary'], lengths: ['Long', 'Very Long'], defaultLength: 'Long', textures: ['Straight', 'Slight Wave', 'Wavy', 'Curly'], defaultTexture: 'Straight', fringes: ['None', 'Curtain Bangs', 'Wispy Bangs', 'Side-Swept'], partings: ['Center', 'Slight Off-Center', 'Side', 'Deep Side'], volumes: ['Flat / Sleek', 'Natural', 'Voluminous', 'Face-Framing'] },
  'Shag / Wolf':      { gender: ['Female', 'Non-Binary'], lengths: ['Medium', 'Long', 'Very Long'], defaultLength: 'Medium', textures: ['Wavy', 'Curly', 'Slight Wave'], defaultTexture: 'Wavy', fringes: ['Curtain Bangs', 'Wispy Bangs', 'None'], defaultFringe: 'Curtain Bangs', partings: ['Center', 'Slight Off-Center'], volumes: ['Voluminous', 'Natural', 'Face-Framing'] },
  'Blunt Cut':        { gender: ['Female', 'Non-Binary'], lengths: ['Short', 'Medium', 'Long'], defaultLength: 'Medium', textures: ['Straight', 'Slight Wave'], defaultTexture: 'Straight', fringes: ['None', 'Blunt Bangs', 'Micro Fringe'], partings: ['Center', 'Slight Off-Center', 'Side'], volumes: ['Flat / Sleek', 'Natural'] },
  'Updo':             { gender: ['Female', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Wavy', 'Curly'], fringes: ['None', 'Curtain Bangs', 'Wispy Bangs', 'Side-Swept'] },
  'Pulled Back':      { gender: ['Female', 'Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Wavy', 'Curly'], fringes: ['None', 'Wispy Bangs', 'Side-Swept'] },
  'Braids':           { gender: ['Female', 'Non-Binary'], lengths: ['Medium', 'Long', 'Very Long'], defaultLength: 'Long', textures: ['Straight', 'Wavy', 'Curly', 'Coily / Afro'] },
  'Crew / Ivy League':{ gender: ['Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Wavy', 'Curly'], partings: ['Side', 'No Part / Slicked'] },
  'French Crop':      { gender: ['Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Wavy'], fringes: ['Blunt Bangs', 'Wispy Bangs', 'Micro Fringe'], defaultFringe: 'Blunt Bangs' },
  'Caesar':           { gender: ['Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Curly'] },
  'Short Textured':   { gender: ['Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Wavy', 'Curly'], partings: ['No Part / Slicked', 'Side', 'Slight Off-Center'], volumes: ['Natural', 'Voluminous', 'Lifted Crown'] },
  'Fade':             { gender: ['Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Wavy', 'Curly', 'Coily / Afro'], volumes: ['Natural', 'Voluminous', 'Lifted Crown'] },
  'Undercut':         { gender: ['Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Wavy'], partings: ['Side', 'No Part / Slicked'], volumes: ['Flat / Sleek', 'Natural', 'Lifted Crown'] },
  'Slick Back':       { gender: ['Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave'], volumes: ['Flat / Sleek', 'Natural'] },
  'Side Part':        { gender: ['Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Wavy'], partings: ['Side', 'Deep Side'], volumes: ['Flat / Sleek', 'Natural'] },
  'Quiff':            { gender: ['Male', 'Non-Binary'], textures: ['Straight', 'Slight Wave', 'Wavy'], volumes: ['Voluminous', 'Lifted Crown', 'Natural'] },
  'Curly Top':        { gender: ['Male', 'Non-Binary'], textures: ['Curly', 'Coily / Afro', 'Wavy'], volumes: ['Natural', 'Voluminous'] },
  'Man Bun':          { gender: ['Male', 'Non-Binary'], lengths: ['Medium', 'Long'], defaultLength: 'Medium', textures: ['Straight', 'Slight Wave', 'Wavy', 'Curly'] },
  'Braids / Locs':    { gender: ['Male', 'Non-Binary'], lengths: ['Short', 'Medium', 'Long', 'Very Long'], defaultLength: 'Medium', textures: ['Straight', 'Curly', 'Coily / Afro'] },
};

export const HAIR_TUCKS = ["None", "One Side", "Both Sides"];
export const HAIR_FADES = ["None", "Low Taper", "Mid Fade", "High Fade", "Skin Fade"];
