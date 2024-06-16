<p align="center">
<img src="https://storage.googleapis.com/badgerwerks/branding/squadron-badge-sm.webp" title="Warp Gate badge"><br>
<img alt="GitHub all releases" src="https://img.shields.io/github/v/release/trioderegion/squadron?color=blue&label=release"> <img alt="GitHub release (latest by date)" src="https://img.shields.io/github/downloads/trioderegion/squadron/latest/module.zip?color=blue&label=downloads%20%28latest%29">
</p>

**Below is a demonstration of Squadron in action.**

https://github.com/trioderegion/squadron/assets/14878515/2cbc815d-f077-4061-9369-460195eb3585

**Below is a demonstration of the, updated orientation options, and the elevation tracking options.**

https://user-images.githubusercontent.com/14878515/150623200-e4337094-cd21-43ad-827f-7d580e867fca.mp4

## Usage

Most of the functionality of Squadron is contained within a button added to a token's right click HUD and has three states of operation, which are detailed below.

### Default (No Leader)

![Pick Leader](https://user-images.githubusercontent.com/14878515/135930777-0ece6f75-026b-4f1b-a456-9e01d6d3d128.png)

Clicking the "Pick Leader" button will prompt the user to click on the token they wish to follow. Once a leader has been selected, a dialog will appear that asks for the "formation direction".

### Leave Formation

![Leave Formation](https://user-images.githubusercontent.com/14878515/135933856-401660ed-6da7-4a8f-821c-8cebd4660a16.png)

While following, this button now controls leaving the formation entirely (i.e. stop following). This restores the Follower to the default state and will not respond to any previous Leader's movements.

### Rejoin Formation

![image](https://user-images.githubusercontent.com/14878515/135933982-1b958073-cf23-485c-8416-a670eb731a90.png)

If a token that is currently in formation or following a leader moves on its own accord (not triggered by its leader moving), then the Follower token will be placed in a "paused" state and will not respond to its Leader's movements. This will also occur (optionally) if the movement required to stay in formation intersects a movement blocking wall. Clicking rejoin formation will cause the Follower to resume following its Leader in formation.

For example, if a group is in formation crawling through a dungeon and enters a room, it is likely that each member of the group will go off and search or investigate their own thing. Once the room as been cleared of monsters or searched, and the group is ready to move on, each follower will simply click Rejoin Formation and will fall back in line with their Leader in the previous formation.

### API

## follow

Signature: ```async squadron.follow(leaderId, followerId, sceneId, orientation = squadron.CONST.QUERY, options={elevation=true,snap=true})```

  ```leaderId```: "string "Id of the token that the token specified by followerId should follow.
  
  ```followerId```: "string "Id of the token that should follow the token specified by leaderId.
  
  ```sceneId```: "string "Id of the scene the tokens can be found in.
  
  ```orientation```: {object} Specifies the orientation the follower token is supposed to keep in regards to the leading token. Accepts any of the values accessible in ```squadron.CONST```. Namely ```squadron.CONST.DOWN```, ```squadron.CONST.LEFT```, ```squadron.CONST.NONE```, ```squadron.CONST.RIGHT```, ```squadron.CONST.UP``` and ```squadron.CONST.QUERY```. In the case ```squadron.CONST.QUERY``` is passed the user will be asked for the direction when the script is executed. This is also the default value.
  
  ```options```: {object} Accepts an object in which the elevation and snap keys can be specified as boolean values. These specify whether the following token follows elevation changes aswell and whether it is supposed to snap to grid when following respectively. By default both are true.

## stop
Signature: ```async squadron.stop(tokenDocument)```
  ```tokenDocument```: {tokenDocument} Stops the token associated with the passed token document from following other tokens and clears all configured following behaviour on it.
  
## pause
Signature: ```async squadron.pause(tokenDocument)```
  ```tokenDocument```: {tokenDocument} Temporarily stops the token associated with the passed token document from following other tokens but does not clear configured following behaviour.
  
##
Signature: `async squadron.resume(tokenDocument)`
```tokenDocument```: {tokenDocument} Resumes paused following behaviour of the token associated with the passed token document.

## Troubleshooting Utilities

Included with Squadron is `squadron.disband`, which will remove ALL squadron data from tokens on the current scene (default) or on ALL scenes with `squadron.disband(true)`. In the unlikely event that Squadron breaks down, garbage follower/leader data may be left on tokens and can be removed using this command.

<p align="center">
<em>Bundled with care by</em>
<br>
<a href="https://www.npmjs.com/package/rollup-config-badger-den">
<img alt="built with Badger Den" src="https://storage.googleapis.com/badgerwerks/branding/badger-den-badge-sm.webp">
</a>
</p>
