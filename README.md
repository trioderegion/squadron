# Squadron

A [Warp Gate](https://github.com/trioderegion/warpgate) pylon for formation, or marching order, management for Foundry VTT. Requires Warp Gate v1.7.4 or higher.

Below is a demonstration of Squadron in action.

https://user-images.githubusercontent.com/14878515/134452536-6e4b532e-5d03-4776-bc4c-5d02be79af46.mp4

Below is a demonstration of the Crosshairs targeting, updated orientation options, and the elevation tracking options.


https://user-images.githubusercontent.com/14878515/150623200-e4337094-cd21-43ad-827f-7d580e867fca.mp4

## Usage

Most of the functionality of Squadron is contained within a button added to a token's right click HUD and has three states of operation, which are detailed below.

### Default (No Leader)

![Pick Leader](https://user-images.githubusercontent.com/14878515/135930777-0ece6f75-026b-4f1b-a456-9e01d6d3d128.png)

Clicking the "Pick Leader" button will prompt the user to click on the token they wish to follow. Once a leader has been selected, a dialog will appear that asks for the "formation direction" (as seen below).

![Formation Direction](https://user-images.githubusercontent.com/14878515/135930980-6cde420d-69d5-4fda-a475-ee3e4efa0952.png)

This dialog asks the user about how the formation is oriented, or in other words, which direction the leader is marching. For example, in the above picture, if I wanted the Follower token to be _behind_ the Leader token while marching, I would select "Right" as the direction. This indicates that the formation is moving to the right. If I instead wanted to walk side-by-side with the Leader token, I would select "Down" or "Up" depending on the exact side (left or right) of the Leader token I want to be on.  The video below illustrates the difference between a "Right" oriented formation and a "Down" oriented formation for the above example image.

https://user-images.githubusercontent.com/14878515/135933778-17614e09-c5e5-4281-b154-427231c03055.mp4

### Leave Formation

![Leave Formation](https://user-images.githubusercontent.com/14878515/135933856-401660ed-6da7-4a8f-821c-8cebd4660a16.png)

While following, this button now controls leaving the formation entirely (i.e. stop following). This restores the Follower to the default state and will not respond to any previous Leader's movements.

### Rejoin Formation

![image](https://user-images.githubusercontent.com/14878515/135933982-1b958073-cf23-485c-8416-a670eb731a90.png)

If a token that is currently in formation or following a leader moves on its own accord (not triggered by its leader moving), then the Follower token will be placed in a "paused" state and will not respond to its Leader's movements. This will also occur (optionally) if the movement required to stay in formation intersects a movement blocking wall. Clicking rejoin formation will cause the Follower to resume following its Leader in formation.

For example, if a group is in formation crawling through a dungeon and enters a room, it is likely that each member of the group will go off and search or investigate their own thing. Once the room as been cleared of monsters or searched, and the group is ready to move on, each follower will simply click Rejoin Formation and will fall back in line with their Leader in the previous formation.

## API

### `async squadron.follow(leaderId, followerId, sceneId, orientation = squadron.CONST.QUERY)`
### `async squadron.stop(tokenDocument)`
### `async squadron.pause(tokenDocument)`
### `async squadron.resume(tokenDocument)`

## Troubleshooting Utilities

Included with Squadron is `squadron.disband`, which will remove ALL squadron data from tokens on the current scene (default) or on ALL scenes with `squadron.disband(true)`. In the unlikely event that Squadron breaks down, garbage follower/leader data may be left on tokens and can be removed using this command.


