# Nature Plant Card

A compact, nature-inspired Lovelace custom card for Home Assistant plant
monitoring. The card is designed for Plant Monitor style `plant.*` entities and
can auto-detect related sensor entities when they are linked to the same device
or share the same entity slug.

## Preview

The default layout uses a compact 150px split glass card with the standard green card surface:
plant image and text on the left, sensor bars on the right.

## Install With HACS

1. Open HACS in Home Assistant.
2. Go to the three-dot menu and choose **Custom repositories**.
3. Add this repository as category **Dashboard**.
4. Install **Nature Plant Card**.
5. Refresh Home Assistant.

HACS should add the Lovelace resource automatically. If it does not, add this
resource manually:

```yaml
url: /hacsfiles/nature-plant-card/nature-plant-card.js
type: module
```

## Manual Install

Copy `dist/nature-plant-card.js` to:

```text
/config/www/community/nature-plant-card/nature-plant-card.js
```

Add it as a Lovelace resource:

```yaml
url: /local/community/nature-plant-card/nature-plant-card.js
type: module
```

## Example

```yaml
type: custom:nature-plant-card
entity: plant.plante_kontor_2
name: Plante kontor
species: Alocasia zebrina
```

Add `image` or `background_image` only when you want to use your own images.

If the card cannot auto-detect the sensors, set them manually:

```yaml
type: custom:nature-plant-card
entity: plant.plante_kontor_2
sensors:
  illuminance: sensor.plantesensor_kontor_illuminance
  moisture: sensor.plantesensor_kontor_moisture
  temperature: sensor.plantesensor_kontor_temperature
  conductivity: sensor.plantesensor_kontor_conductivity
```

## Visual Editor

The card includes a visual Lovelace editor for:

- Plant entity
- Optional name, species, image, and height
- Optional decorative background image
- Sensor overrides
- Colors

## Colors

```yaml
type: custom:nature-plant-card
entity: plant.plante_kontor_2
colors:
  surface: rgba(60, 94, 74, 0.72)
  border: rgba(168, 196, 154, 0.18)
  accent: "#A8C49A"
  text: "#EAD8B5"
  muted: rgba(234,216,181,0.84)
  light: "#F2C75D"
  warning: "#E9695A"
  track: rgba(168,196,154,0.16)
```
