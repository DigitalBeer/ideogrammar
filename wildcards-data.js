/* wildcards-data.js — built-in starter wildcard lists, rules and style templates.
 * Everything here can be edited in the app; edits are stored as an overlay
 * (localStorage / synced folder) and "Restore built-in" brings these back.
 * List text uses the Dynamic Prompts file format: one item per line, "2::item"
 * weights, "# comments", and items may contain wildcard syntax themselves.
 */
const WC_BUILTIN_LISTS = {
  // ---- colour & material
  "colours": `red\ncrimson\nscarlet\nburgundy\ncoral\norange\namber\nmustard yellow\nlemon yellow\nolive green\nemerald green\nmint green\nteal\nturquoise\ncyan\nsky blue\ncobalt blue\nnavy blue\nindigo\nviolet\nlavender\nmagenta\nhot pink\npastel pink\nbeige\ncream\nivory\nwhite\nsilver\ncharcoal grey\nblack\nchocolate brown\ncopper\ngold`,
  "colour-schemes": `monochrome {black and white|sepia|blue}\ncomplementary orange and teal\nmuted pastel tones\nhigh-contrast primary colours\nearthy browns and greens\nneon pink and electric blue\ncool desaturated blues\nwarm golden tones\nduotone __colours__ and __colours__\nvibrant saturated colours`,
  "materials": `brushed steel\npolished chrome\nweathered wood\nraw concrete\nmarble\nterracotta\nfrosted glass\nleather\nsuede\nvelvet\nsilk\ndenim\nwool knit\ncarbon fibre\nmatte plastic\nceramic\nrusted iron\nbrass\nholographic foil\nrecycled paper`,
  "textures": `rough\nglossy\nmatte\nsatin\ngrainy\ncrackled\nfuzzy\nwet\ndusty\nscratched\nembossed\nwoven\npitted\nmirror-smooth\nfrosted`,
  "patterns": `pinstripes\nhoundstooth\nplaid\npolka dots\nchevron\nfloral print\ncamouflage\nleopard print\ngeometric tiles\npaisley\ncheckerboard\ntie-dye`,

  // ---- light
  "lighting/setups": `soft three-point studio lighting\nhard key light with deep shadows\nRembrandt lighting\nbutterfly lighting\nsplit lighting\nrim lighting from behind\nlarge softbox from the front\nring light\nbounce light off a white wall\nhigh-key lighting\nlow-key chiaroscuro lighting\ncolour-gel lighting in __colours__ and __colours__`,
  "lighting/natural": `golden hour sunlight\nblue hour twilight\nharsh midday sun\nsoft overcast daylight\ndappled light through leaves\nwindow light\nbacklit by a low sun\nfoggy diffused light\nmoonlight\nstorm light with dark clouds`,
  "lighting/practical": `neon signs\nstreetlights\ncandlelight\nfirelight\nstring lights\nstadium floodlights\nstage spotlights\nflickering fluorescent tubes\nlaptop screen glow\nlanterns`,
  "light-sources": `__lighting/setups__\n__lighting/natural__\n__lighting/practical__`,

  // ---- camera
  "camera/bodies": `Canon EOS R5\nNikon Z9\nSony A7R V\nFujifilm X-T5\nLeica M11\nHasselblad X2D\nPhase One IQ4\nPentax 67\nMamiya RZ67\nContax T2\nPolaroid SX-70\nKodak Brownie\nARRI Alexa Mini\nRED V-Raptor\niPhone`,
  "camera/lenses": `14mm ultra-wide\n24mm wide-angle\n35mm\n50mm prime\n85mm portrait lens\n105mm macro\n135mm telephoto\n200mm telephoto\n400mm super-telephoto\n8mm fisheye\ntilt-shift lens\nanamorphic lens\nvintage Helios 44-2`,
  "camera/apertures": `f/1.2\nf/1.4\nf/1.8\nf/2.8\nf/4\nf/5.6\nf/8\nf/11\nf/16`,
  "camera/film-stocks": `Kodak Portra 400\nKodak Ektar 100\nKodak Tri-X 400\nKodachrome 64\nFujifilm Velvia 50\nFujifilm Pro 400H\nIlford HP5 Plus\nCinestill 800T\nPolaroid instant film\nLomography Color 800`,
  "camera/shots": `extreme close-up\nclose-up\nmedium close-up\nmedium shot\ncowboy shot\nfull-body shot\nwide shot\nextreme wide shot\nestablishing shot\nover-the-shoulder shot\ntwo-shot\ninsert detail shot`,
  "camera/angles": `eye level\nlow angle\nworm's-eye view\nhigh angle\nbird's-eye view\noverhead flat lay\nDutch angle\nthree-quarter view\nprofile view\nfrom behind`,
  "camera/compositions": `rule of thirds\ncentred symmetrical composition\nleading lines\nframe within a frame\nnegative space\ngolden spiral\ndiagonal composition\nlayered foreground, midground and background\nshallow depth of field with creamy bokeh\ndeep focus`,
  "camera/motion": `frozen motion\nmotion blur\npanning blur\nlong exposure light trails\nzoom burst\nfreeze-frame action`,
  "camera/setup": `__camera/shots__, __camera/angles__, shot on __camera/bodies__ with a __camera/lenses__ at __camera/apertures__`,

  // ---- time & place
  "time-of-day": `dawn\nsunrise\nearly morning\nmidday\nlate afternoon\ngolden hour\nsunset\nblue hour\ndusk\nnight\nmidnight`,
  // Weighted so calm weather is the norm and storms are occasional (snow ~1 in 12, blizzard ~1 in 40).
  "weather": `# weights: 3:: = three times as likely as a plain line\n3::clear skies\n2::overcast sky\n2::partly cloudy with soft clouds\n2::bright sunny day\n1.5::light haze\nlight rain\n0.6::heavy rain\ndrizzle\nfog\nmist\nwindy\n0.7::snowfall\n0.3::blizzard\n0.5::thunderstorm\n0.5::heatwave haze\nafter the rain, wet reflective ground`,
  "seasons": `spring\nsummer\nautumn\nwinter`,
  "places/urban": `neon-lit city street\nrooftop overlooking the skyline\nsubway platform\nback alley\nbusy market\nparking garage\nlaundromat\ndiner\nskate park\nconstruction site\nbridge at night\ntrain station concourse`,
  "places/indoor": `minimalist studio\ncosy living room\nindustrial loft\nlibrary\nmuseum gallery\ngreenhouse\nkitchen\nbedroom\nrecording studio\nboxing gym\nlocker room\nhotel lobby`,
  "places/nature": `pine forest\nmisty mountains\ndesert dunes\ntropical beach\nrocky coastline\nwildflower meadow\nwaterfall\nfrozen lake\nbamboo grove\ncanyon\nrolling hills\nvolcanic landscape`,
  // Guards tie the venue to a "sport" variable when one is set (e.g. by a template); [sport!=*] = only when it isn't.
  "places/sports": `# venue follows \${sport} when a template sets it\n[sport=football] packed football stadium\n[sport=basketball] indoor basketball arena\n[sport=tennis] {centre court of a tennis stadium|clay tennis court}\n[sport=boxing] boxing ring under hot lights\n[sport=ice hockey] ice hockey rink\n[sport=Formula racing] {race track|pit lane}\n[sport=skateboarding] skate park\n[sport=surfing] surf break with a big wave\n[sport=baseball] baseball diamond\n[sport=sprinting] athletics track\n[sport=golf] golf course\n[sport=rock climbing] climbing wall\n[sport!=*] {packed football stadium|indoor basketball arena|tennis court|boxing ring|race track|athletics track}`,
  "places": `__places/urban__\n__places/indoor__\n__places/nature__`,

  // ---- people
  "people/ages": `young child\nteenager\nyoung adult\nadult in their thirties\nmiddle-aged adult\nelderly person`,
  "people/roles": `athlete\nchef\nmusician\nastronaut\nfirefighter\nscientist\nskateboarder\ndancer\nfarmer\nmechanic\npilot\nsurfer\nboxer\ngamer\nphotographer\nbarista\narchitect\ndetective`,
  "people/expressions": `beaming smile\nconfident smirk\nintense focus\nserene calm\nlaughing\ndetermined stare\nthoughtful gaze\nsurprised\nfierce shout\ngentle smile`,
  "people/poses": `arms crossed\nhands in pockets\nmid-stride walking\njumping in the air\nsitting on steps\nleaning against a wall\nlooking over the shoulder\ncelebrating with fists raised\ncrouching low\nhand on hip\nmid-action swing`,
  "people/hairstyles": `buzz cut\nshort crop\nbob cut\nlong flowing hair\ncurly afro\nbraids\nponytail\nman bun\nundercut\npixie cut\nmohawk\nslicked-back hair`,
  "people/builds": `slim\nathletic\nmuscular\nstocky\ntall and lean\npetite`,

  // ---- clothes
  "clothes/tops": `t-shirt\nhoodie\nturtleneck\nbutton-down shirt\nflannel shirt\ntank top\nknit sweater\ngraphic tee\nsilk blouse\npolo shirt`,
  "clothes/bottoms": `jeans\ncargo trousers\ntailored trousers\nshorts\npleated skirt\njoggers\nleather trousers\nmaxi skirt`,
  "clothes/outerwear": `leather jacket\ndenim jacket\ntrench coat\nbomber jacket\npuffer jacket\nblazer\nraincoat\nvarsity jacket\nparka`,
  "clothes/hats": `baseball cap\nbeanie\nfedora\nbucket hat\nberet\nwide-brim sun hat\nsnapback`,
  "clothes/shoes": `sneakers\ncombat boots\nloafers\nhigh-top trainers\nsandals\nheels\nhiking boots\nslip-ons`,
  "clothes/accessories": `aviator sunglasses\nsilver chain necklace\nwristwatch\nheadphones around the neck\nbackpack\nscarf\nhoop earrings\nleather gloves`,
  "clothes/sportswear": `[sport=football,basketball,ice hockey,baseball] __colours__ team jersey with a number\n[sport=football] football kit in __colours__ and __colours__\n[sport=tennis] {tennis whites|__colours__ tennis dress|polo shirt and shorts with a sweatband}\n[sport=boxing] {boxing robe|__colours__ boxing shorts and gloves}\n[sport=Formula racing] __colours__ racing suit and helmet\n[sport=surfing] wetsuit\n[sport=sprinting] {__colours__ running vest and shorts|compression top}\n[sport=skateboarding] {__colours__ hoodie and cargo trousers|__colours__ graphic tee and {ripped jeans|baggy chinos|shorts}|oversized __colours__ flannel shirt and __colours__ skate shorts}\n[sport=golf] polo shirt and chinos\n[sport=rock climbing] chalk bag and climbing harness\n[sport!=*] {__colours__ team jersey with a number|compression top|tracksuit|boxing robe|racing suit|wetsuit|tennis whites}`,
  "clothes/outfit": `__colours__ __clothes/tops__, __clothes/bottoms__ and __clothes/shoes__\n__colours__ __clothes/outerwear__ over a __clothes/tops__, __clothes/bottoms__\n{__clothes/hats__, |}__colours__ __clothes/tops__ with __clothes/accessories__`,

  // ---- style
  "art-styles": `oil painting\nwatercolour\ngouache\ncharcoal drawing\nink wash\nlinocut print\nrisograph print\nscreen print\npixel art\nlow-poly 3D\nclaymation\npaper cut-out collage\nvector flat illustration\nanime cel shading\ncomic book inks\nart nouveau\nart deco\nukiyo-e woodblock\nbauhaus poster\nvaporwave`,
  "eras": `1920s\n1940s\n1950s\n1960s\n1970s\n1980s\n1990s\nY2K 2000s\nVictorian era\nfar future`,
  "moods": `joyful\nmoody\nmelancholic\ntriumphant\neerie\nromantic\nnostalgic\ntense\nserene\nchaotic\nplayful\nepic`,
  "medium": `35mm film photograph\ndigital photograph\nmedium-format photograph\nPolaroid snapshot\n3D render\ndigital illustration\noil painting\nwatercolour painting\nmagazine print`,

  // ---- genres
  "magazine/genres": `fashion\nsports\nmusic\nfilm\nscience\ntravel\nfood\nbusiness\ngaming\ntechnology\narchitecture\nfitness`,
  "magazine/cover-lines": `THE {NEW|BIG|BOLD} ISSUE\n{10|25|50|100} THINGS TO KNOW\nEXCLUSIVE INTERVIEW\nSPECIAL EDITION\nTHE FUTURE OF __magazine/genres__\nSUMMER {GUIDE|SPECIAL}`,
  "sports": `football\nbasketball\ntennis\nboxing\nice hockey\nFormula racing\nskateboarding\nsurfing\nbaseball\nsprinting\ngolf\nrock climbing`,
  "game/hud": `score bug in the top corner\nplayer name tag and number\nstamina bar\nmini-map\nreplay banner\nbroadcast lower-third graphic`,
};

// Hex for the built-in colour names: when a roll picks a colour for an element,
// that element's palette follows it (otherwise a stale palette overrides the words).
const WC_COLOUR_HEX = {
  "red": "#D7263D", "crimson": "#B0122C", "scarlet": "#E3241B", "burgundy": "#6D1A2E", "coral": "#FF7F61", "orange": "#F57C1F",
  "amber": "#F5A623", "mustard yellow": "#D4A72C", "lemon yellow": "#F7E64B", "olive green": "#6B7A2E", "emerald green": "#1F8A5B",
  "mint green": "#98E2C6", "teal": "#14807F", "turquoise": "#2EC4B6", "cyan": "#1FC8E3", "sky blue": "#7EC8F2", "cobalt blue": "#1F4FBF",
  "navy blue": "#1B2A4A", "indigo": "#3F3D99", "violet": "#7F3FBF", "lavender": "#B9A6E3", "magenta": "#D6248F", "hot pink": "#FF4FA3",
  "pastel pink": "#F6C6D8", "beige": "#D9C7A7", "cream": "#F3E9D2", "ivory": "#F8F4E6", "white": "#FFFFFF", "silver": "#C0C4C8",
  "charcoal grey": "#36393E", "black": "#111111", "chocolate brown": "#5A3825", "copper": "#B8733A", "gold": "#D4AF37",
};

// Global rules (editable in the Wildcard manager → Rules).
const WC_BUILTIN_RULES = [
  { name: "Sunny light means no storm", when: { list: "lighting/natural", is: ["golden hour sunlight", "harsh midday sun", "backlit by a low sun", "dappled light through leaves"] }, then: { list: "weather", exclude: ["snowfall", "blizzard", "heavy rain", "thunderstorm", "fog", "drizzle", "*rain*"] } },
  { name: "No sunlight at night", when: { list: "time-of-day", is: ["night", "midnight", "blue hour", "dusk"] }, then: { list: "lighting/natural", exclude: ["golden hour sunlight", "harsh midday sun", "backlit by a low sun", "dappled light through leaves"] } },
  { name: "Winter means snow or clear", when: { list: "seasons", is: ["winter"] }, then: { list: "weather", exclude: ["heatwave haze"] } },
  { name: "No snow in summer", when: { list: "seasons", is: ["summer"] }, then: { list: "weather", exclude: ["snowfall", "blizzard"] } },
];

// Style templates. Any value may contain wildcard syntax.
//   global: fields for the whole image (style_description keys, background, hld_suffix, palette)
//   element: per-element style fields + desc_prefix / desc_suffix
//   vars: template variables (set first, usable as ${name} anywhere in the template and in guards)
//   llmNotes: extra direction for "Polish with AI" and Generate
//   formats.moss / formats.ideogram: optional overrides of global/element per output format
//   cast: extra elements the template adds by itself (see wildcards-cast.js)
const WC_BUILTIN_TEMPLATES = [
  {
    id: "magazine-cover", name: "Magazine cover", category: "Editorial", scope: "both",
    vars: { genre: "__magazine/genres__" },
    global: {
      aesthetics: "glossy ${genre} magazine cover, bold masthead typography, clean editorial layout, high-end retouching",
      lighting: "{__lighting/setups__|soft beauty-dish key light with a subtle rim light}",
      photo: "{medium shot|medium close-up} at {eye level|a slightly low angle}, {85mm portrait lens|105mm}, f/{2.8|4}, crisp focus on the eyes",
      medium: "professional magazine cover photograph",
      background: "{seamless __colours__ studio backdrop|softly blurred __places__}",
      hld_suffix: "styled as the cover of a ${genre} magazine",
    },
    element: { wardrobe: "{__clothes/outfit__|designer __colours__ outfit}", pose: "__people/poses__", mood: "{confident|striking|playful}" },
    llmNotes: "Make it read like a real newsstand cover: masthead at the top, a strong cover star, two or three short cover lines.",
  },
  {
    id: "fashion-editorial", name: "Fashion editorial", category: "Editorial", scope: "both",
    global: {
      aesthetics: "high-fashion editorial spread, avant-garde styling, {minimal|maximalist} set design",
      lighting: "{hard key light with deep shadows|colour-gel lighting in __colours__ and __colours__|soft overcast daylight}",
      photo: "shot on {__camera/bodies__|Hasselblad X2D}, {50mm prime|85mm portrait lens}, __camera/film-stocks__ look",
      medium: "fashion photograph",
      background: "{__places/indoor__|__places/urban__}, styled for a fashion shoot",
    },
    element: { wardrobe: "{2$$__clothes/outerwear__|__clothes/tops__|__clothes/accessories__} in __colours__", pose: "__people/poses__", mood: "__moods__" },
  },
  {
    id: "sports-game-cover", name: "Sports video game cover", category: "Sports", scope: "both",
    vars: { sport: "__sports__" },
    global: {
      aesthetics: "AAA ${sport} video game box art, heroic hyper-real athlete, dramatic particles and sweat, bold title treatment, {2020s|2000s} sports game cover style",
      lighting: "stadium floodlights with strong rim lighting, a {__colours__|blue} accent light and lens flare",
      photo: "low angle hero shot, {24mm wide-angle|35mm}, frozen motion, ultra-sharp",
      medium: "digital composite cover art",
      background: "__places/sports__ blurred with crowd and light streaks",
      hld_suffix: "as a ${sport} video game cover",
    },
    element: { wardrobe: "__clothes/sportswear__", pose: "{celebrating with fists raised|mid-action swing|crouching low|jumping in the air}", mood: "{fierce|triumphant|intense}" },
    llmNotes: "Cover star large in the foreground, game title big and readable, publisher/rating marks small in a corner.",
  },
  {
    id: "sports-broadcast", name: "Sports broadcast / in-game", category: "Sports", scope: "both",
    vars: { sport: "__sports__" },
    global: {
      aesthetics: "${sport} TV broadcast frame, photoreal in-game graphics, {next-gen console|live broadcast} look",
      lighting: "even stadium floodlighting",
      photo: "{broadcast telephoto from the stands|sideline camera|replay cam}, {400mm super-telephoto|200mm telephoto}, {panning blur on the action|frozen motion}",
      medium: "sports broadcast frame grab",
      background: "__places/sports__ with a packed crowd",
    },
    element: { wardrobe: "__clothes/sportswear__", pose: "mid-action", extra: "{40%? __game/hud__}" },
    cast: [
      { name: "score graphic", type: "text", desc: "${sport} TV score bug graphic with team abbreviations, score and game clock", text: "{HOME|LDN|NYC} {0|1|2|3} - {0|1|2} {AWAY|PAR|TOK}", font: "condensed bold sans-serif broadcast graphics", place: "top-left", chance: 85, min: 1, max: 1 },
      { name: "opponent", type: "subject", desc: "an opposing ${sport} player chasing the play", styled: true, place: "back", chance: 60, min: 1, max: 2 },
    ],
  },
  {
    id: "cinematic-still", name: "Cinematic film still", category: "Film", scope: "both",
    global: {
      aesthetics: "cinematic film still, {2.39:1 widescreen|anamorphic} framing, {teal and orange grade|bleach bypass grade|warm nostalgic grade}, film grain",
      lighting: "{practical lighting from __lighting/practical__|moody low-key chiaroscuro lighting|__lighting/natural__}",
      photo: "__camera/shots__, shot on {ARRI Alexa Mini|RED V-Raptor|__camera/film-stocks__}, {anamorphic lens|35mm|50mm prime}, shallow depth of field",
      medium: "motion picture still",
      background: "__places__ at __time-of-day__, __weather__",
    },
    element: { wardrobe: "__clothes/outfit__", mood: "__moods__" },
  },
  {
    id: "film-noir", name: "Film noir", category: "Film", scope: "both",
    global: {
      aesthetics: "1940s film noir, black and white, venetian-blind shadows, smoky atmosphere",
      lighting: "hard low-key lighting with deep blacks and slatted shadows",
      photo: "{35mm|50mm prime}, {Dutch angle|low angle}, high contrast",
      medium: "black and white film photograph",
      background: "{rain-slick back alley at night|detective's office with blinds|__places/urban__ at night, fog}",
      color_palette: ["#000000", "#2B2B2B", "#7A7A7A", "#E5E5E5"],
    },
    element: { wardrobe: "{trench coat and fedora|1940s evening dress|three-piece suit}", lighting: "hard slatted shadow across the face", mood: "{tense|mysterious|menacing}" },
  },
  {
    id: "product-hero", name: "Product hero shot", category: "Commercial", scope: "both",
    global: {
      aesthetics: "premium product advertising, {minimal|bold graphic} layout, crisp reflections",
      lighting: "{large softbox from the front|rim lighting from behind|gradient strip lights}",
      photo: "{three-quarter view|eye-level view|overhead flat lay}, {105mm macro|85mm portrait lens}, f/{8|11}, focus stacked, studio product photography",
      medium: "commercial product photograph",
      background: "{seamless __colours__ backdrop|__materials__ surface with soft shadow|floating on a __colour-schemes__ gradient}",
    },
    element: { lighting: "clean specular highlights", extra: "{surface of __materials__|water droplets|floating ingredients}" },
  },
  {
    id: "street-photo", name: "Street photography", category: "Documentary", scope: "both",
    global: {
      aesthetics: "candid street photography, decisive moment, {gritty|vibrant} urban texture",
      lighting: "__lighting/natural__",
      photo: "{Leica M11|Fujifilm X-T5|Contax T2}, 35mm, {at eye level|shot from the hip}, zone focus, {__camera/film-stocks__|digital} look",
      medium: "{35mm film photograph|digital photograph}",
      background: "__places/urban__, __weather__",
    },
    element: { wardrobe: "__clothes/outfit__", mood: "{candid|unposed|absorbed}" },
    cast: [
      { name: "passer-by", type: "subject", desc: "a passer-by {walking past|waiting to cross|looking at a phone}, slightly out of focus", style: { wardrobe: "__clothes/outfit__" }, place: "anywhere", chance: 55, min: 1, max: 2 },
    ],
  },
  {
    id: "retro-80s", name: "80s retro", category: "Retro", scope: "both",
    global: {
      aesthetics: "1980s retro, synthwave neon, chrome lettering, VHS scan lines",
      lighting: "neon pink and electric blue rim lights",
      photo: "{airbrushed|35mm} look, soft halation",
      medium: "{1980s poster art|retro airbrush illustration|VHS cover art}",
      background: "{neon grid horizon with a setting sun|palm-lined boulevard at night|arcade interior}",
      color_palette: ["#FF2E97", "#00E5FF", "#1B0B3A", "#FFD319"],
    },
    element: { wardrobe: "{neon windbreaker|leather jacket with rolled sleeves|aerobics outfit}", mood: "{cool|nostalgic|energetic}" },
  },
  {
    id: "anime-key-visual", name: "Anime key visual", category: "Illustration", scope: "both",
    global: {
      aesthetics: "anime key visual, crisp cel shading, dynamic composition, detailed background art",
      lighting: "{dramatic sunset backlight|sparkling summer light|moody rain light}",
      photo: "",
      medium: "digital anime illustration",
      art_style: "modern anime key visual, clean line art, painterly background",
      background: "{__places/urban__|__places/nature__} at __time-of-day__",
    },
    element: { pose: "__people/poses__", wardrobe: "{school uniform|__clothes/outfit__}", mood: "__moods__" },
  },
  {
    id: "documentary", name: "Documentary", category: "Documentary", scope: "both",
    global: {
      aesthetics: "photojournalism, honest and unstaged, {National Geographic|press agency} style",
      lighting: "available light, __lighting/natural__",
      photo: "__camera/shots__, {24mm wide-angle|35mm|70-200mm telephoto}, f/{2.8|5.6}, natural colour",
      medium: "documentary photograph",
      background: "__places__, __weather__",
    },
    element: { wardrobe: "__clothes/outfit__", mood: "{absorbed|weathered|resilient}" },
  },
  {
    id: "concert", name: "Concert / live", category: "Music", scope: "both",
    global: {
      aesthetics: "live concert photography, sweat and haze, crowd energy",
      lighting: "stage spotlights and {__colours__|magenta and blue} beams through haze",
      photo: "{200mm telephoto from the pit|24mm wide-angle on stage}, f/2.8, high ISO grain",
      medium: "live music photograph",
      background: "{packed arena|small club stage|festival main stage at night} with silhouetted crowd",
    },
    element: { lighting: "hard backlight through haze", wardrobe: "{__colours__ stage outfit|__clothes/outfit__}", pose: "{mid-song with mic|guitar raised|leaning into the crowd}", mood: "{euphoric|raw|intense}" },
    cast: [
      { name: "crowd", type: "obj", desc: "silhouetted crowd {with raised hands|holding up phones|mid-jump}, heads and arms against the stage light", place: "front", chance: 90, min: 1, max: 1 },
    ],
  },
];

if (typeof module !== "undefined" && module.exports) module.exports = { WC_BUILTIN_LISTS, WC_BUILTIN_RULES, WC_BUILTIN_TEMPLATES, WC_COLOUR_HEX };
